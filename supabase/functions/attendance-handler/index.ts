import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action, ...payload } = await req.json()
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } }
    }).auth.getUser()

    if (authError || !user) throw new Error('Unauthorized')

    if (action === 'GENERATE_QR_TOKEN') {
      const { sessionId } = payload
      // Verify user is teacher of this course
      const { data: session } = await supabase
        .from('class_sessions')
        .select('*, courses!inner(course_teachers!inner(teacher_id))')
        .eq('id', sessionId)
        .eq('courses.course_teachers.teacher_id', user.id)
        .single()

      if (!session) throw new Error('Access denied')

      // Generate a token based on time (10s window)
      const timeStep = Math.floor(Date.now() / 10000)
      const data = new TextEncoder().encode(`${session.otp_secret}-${timeStep}`)
      const hashBuffer = await crypto.subtle.digest("SHA-256", data)
      const token = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

      return new Response(JSON.stringify({ token, sessionId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'MARK_ATTENDANCE') {
      const { sessionId, token } = payload
      
      const { data: session } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (!session) throw new Error('Session not found')

      // Validate token (check current and previous to handle jitter)
      const validate = async (step: number) => {
        const data = new TextEncoder().encode(`${session.otp_secret}-${step}`)
        const hashBuffer = await crypto.subtle.digest("SHA-256", data)
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
      }

      const currentStep = Math.floor(Date.now() / 10000)
      const validTokens = [await validate(currentStep), await validate(currentStep - 1)]

      if (!validTokens.includes(token)) throw new Error('Invalid or expired QR code')

      const { error: attError } = await supabase
        .from('attendance')
        .upsert({ session_id: sessionId, student_id: user.id })

      if (attError) throw attError

      return new Response(JSON.stringify({ message: 'Attendance marked!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

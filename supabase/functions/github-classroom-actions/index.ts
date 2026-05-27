import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const githubToken = Deno.env.get('GITHUB_ACCESS_TOKEN')

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { action, ...payload } = await req.json()

    if (action === 'ACCEPT_ASSIGNMENT') {
      const { assignmentId } = payload
      const { data: assignment } = await supabaseClient.from('assignments').select('*, courses(*)').eq('id', assignmentId).single()
      
      // Check lock date
      if (assignment.lock_date && new Date() > new Date(assignment.lock_date)) {
          throw new Error('Assignment is closed and cannot be accepted.')
      }

      const username = user.user_metadata.user_name || user.id
      const newRepoName = `${assignment.courses.name}-${assignment.title}-${username}`.toLowerCase().replace(/[^a-z0-9]/g, '-')

      // Generate repo from template
      const templateParts = assignment.template_repo_url.split('/')
      const templateOwner = templateParts[templateParts.length - 2]
      const templateRepo = templateParts[templateParts.length - 1]

      const resp = await fetch(`https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`, {
        method: 'POST',
        headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' },
        body: JSON.stringify({ owner: assignment.courses.github_org, name: newRepoName, private: true })
      })
      const githubData = await resp.json()
      if (!resp.ok) throw new Error(`GitHub: ${githubData.message}`)

      // Add student as collaborator (push access initially)
      await fetch(`https://api.github.com/repos/${assignment.courses.github_org}/${newRepoName}/collaborators/${username}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubToken}` },
        body: JSON.stringify({ permission: 'push' })
      })

      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      await adminClient.from('submissions').upsert({
          assignment_id: assignmentId, student_id: user.id, student_repo_url: githubData.html_url, status: 'accepted'
      })

      return new Response(JSON.stringify({ repo_url: githubData.html_url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'SUBMIT_ASSIGNMENT') {
      const { assignmentId } = payload
      const { data: submission } = await supabaseClient.from('submissions').select('*, assignments(*)').eq('assignment_id', assignmentId).eq('student_id', user.id).single()
      
      if (submission.assignments.lock_date && new Date() > new Date(submission.assignments.lock_date)) {
          throw new Error('Lock date reached. Repository is now read-only.')
      }

      // Existing logic to get commit and create PR...
      const repoUrl = submission.student_repo_url.replace('https://github.com/', '')
      const [owner, repo] = repoUrl.split('/')
      const username = user.user_metadata.user_name || user.id

      // 1. Change collaborator permission to 'pull' (Read-only)
      await fetch(`https://api.github.com/repos/${owner}/${repo}/collaborators/${username}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubToken}` },
        body: JSON.stringify({ permission: 'pull' })
      })

      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      await adminClient.from('submissions').update({ status: 'sin_corregir', is_locked: true, submitted_at: new Date().toISOString() }).eq('id', submission.id)

      return new Response(JSON.stringify({ message: 'Submitted and locked for review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'CHECK_LOCKS') {
        // This action could be called by a CRON job to lock all repos after lock_date
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)
        const { data: expired } = await adminClient.from('submissions')
            .select('*, assignments!inner(*), profiles!inner(user_name)')
            .eq('is_locked', false)
            .lt('assignments.lock_date', new Date().toISOString())

        for (const sub of expired) {
            const repoUrl = sub.student_repo_url.replace('https://github.com/', '')
            const [owner, repo] = repoUrl.split('/')
            const username = sub.profiles.user_name

            await fetch(`https://api.github.com/repos/${owner}/${repo}/collaborators/${username}`, {
                method: 'PUT',
                headers: { 'Authorization': `token ${githubToken}` },
                body: JSON.stringify({ permission: 'pull' })
            })
            await adminClient.from('submissions').update({ is_locked: true }).eq('id', sub.id)
        }
        return new Response('Locks updated', { headers: corsHeaders })
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
}

serve(handler)

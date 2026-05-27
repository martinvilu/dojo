import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { action, ...payload } = await req.json()
    const githubToken = Deno.env.get('GITHUB_ACCESS_TOKEN') // Should be a teacher/org admin token

    if (action === 'ACCEPT_ASSIGNMENT') {
      const { assignmentId } = payload
      
      // 1. Get assignment details
      const { data: assignment, error: aErr } = await supabaseClient
        .from('assignments')
        .select('*, courses(*)')
        .eq('id', assignmentId)
        .single()
      
      if (aErr || !assignment) throw new Error('Assignment not found')

      // 2. Check if student is in roster
      const { data: roster, error: rErr } = await supabaseClient
        .from('course_roster')
        .select('*')
        .eq('course_id', assignment.course_id)
        .or(`student_id.eq.${user.id},student_email.eq.${user.email}`)
        .single()

      if (rErr || !roster) throw new Error('Not enrolled in course')

      // 3. Create repo from template on GitHub
      const templateRepoUrl = assignment.template_repo_url.replace(/\/$/, '')
      const templateParts = templateRepoUrl.split('/')
      const templateOwner = templateParts[templateParts.length - 2]
      const templateRepo = templateParts[templateParts.length - 1]

      const username = user.user_metadata.user_name || user.id
      const newRepoName = `${assignment.courses.name}-${assignment.title}-${username}`.toLowerCase().replace(/[^a-z0-9]/g, '-')

      const resp = await fetch(`https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: assignment.courses.github_org,
          name: newRepoName,
          private: true,
          description: `Assignment for ${assignment.title} - ${username}`,
          include_all_branches: false,
        })
      })

      const githubData = await resp.json()
      if (!resp.ok) throw new Error(`GitHub Error: ${githubData.message || 'Unknown error'}`)

      // 4. Add student as collaborator
      await fetch(`https://api.github.com/repos/${assignment.courses.github_org}/${newRepoName}/collaborators/${username}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ permission: 'push' })
      })

      // 5. Update submission in DB using service role to ensure it can update/insert
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      const { error: sErr } = await adminClient
        .from('submissions')
        .upsert({
          assignment_id: assignmentId,
          student_id: user.id,
          student_repo_url: githubData.html_url,
          status: 'accepted'
        })

      if (sErr) throw sErr

      return new Response(JSON.stringify({ repo_url: githubData.html_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'SUBMIT_ASSIGNMENT') {
      const { assignmentId } = payload
      
      const { data: submission, error: sErr } = await supabaseClient
        .from('submissions')
        .select('*, assignments(*, courses(*))')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .single()

      if (sErr || !submission) throw new Error('Submission not found')

      const repoUrl = submission.student_repo_url.replace('https://github.com/', '')
      const [owner, repo] = repoUrl.split('/')

      // 1. Get latest commit date from GitHub
      const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/main`, {
        headers: { 'Authorization': `token ${githubToken}` }
      })
      const commitData = await commitResp.json()
      const lastCommitAt = commitData.commit?.committer?.date || new Date().toISOString()

      // 2. Create PR (feedback)
      const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Feedback: ${submission.assignments.title}`,
          head: 'main',
          base: 'feedback', // We assume feedback branch was created during ACCEPT_ASSIGNMENT (can be improved)
          body: 'Estudiante ha solicitado revisión.',
        })
      })

      const githubData = await resp.json()
      
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      await adminClient
        .from('submissions')
        .update({ 
          status: 'sin_corregir', 
          pr_url: githubData.html_url || null,
          submitted_at: new Date().toISOString(),
          last_commit_at: lastCommitAt
        })
        .eq('id', submission.id)

      return new Response(JSON.stringify({ message: 'Enviado a revisión', pr_url: githubData.html_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ message: 'Action not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
}

serve(handler)

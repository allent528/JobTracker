// Maximum text lengths, mirrored by `<table>_<column>_length` check constraints in
// supabase/migrations; check-constraints.test.ts keeps them equal. Zod schemas use these.
export const TEXT_LIMITS = {
  applications: {
    company: 200,
    role_title: 200,
    job_url: 2048,
    location: 200,
    source: 200,
    description: 20000,
    follow_up_note: 500,
  },
  notes: { body: 20000 },
  contacts: {
    name: 200,
    title: 200,
    email: 320,
    phone: 200,
    linkedin_url: 2048,
    notes: 20000,
  },
  interviews: { location: 2048, interviewers: 500, notes: 20000 },
} as const;

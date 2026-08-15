# Career intake

Normalize the request into one record before routing.

| Field | Record |
| --- | --- |
| stage | `entry`, `new-hire`, `junior-growth`, `transition`, or `unclear` |
| target role | Role family, specialization, and target level when known |
| target industry | Game industry segment or adjacent industry when relevant |
| target company | Named employer or `unspecified` |
| target project | Named game, genre, platform, or product context |
| current artifacts | Portfolio, resume, analysis, design documents, interview notes |
| current projects | Shipped, live, prototype, study, team, or personal work |
| available time | Deadline, weekly capacity, and review cadence |
| constraints | Confidentiality, rights, access, geography, language, tools, budget, health, or schedule |
| desired outputs | Decision, roadmap, evidence matrix, artifact, review, interview practice, visualization, or export |

## Memory normalization

```json
{
  "projectId": "existing-artifact-or-explicit-user-id",
  "memoryDisabledForRequest": false
}
```

Normalize an explicit request such as “do not use previous memory for this work” to `memoryDisabledForRequest = true`; it skips retrieval and candidate capture for this request. When there is no project ID, skip memory as `skipped-project-id-missing`; ask only if the ID materially branches the career route, and continue the baseline workflow. Memory unavailability never blocks the Career Stage & Goal Brief.

Record every safe assumption explicitly and proceed. Ask only when a missing answer materially branches the route, target audience, evidence standard, artifact type, or irreversible work. Ask one concise question at a time and preserve all completed non-branching work.

Treat current employer, project, job posting, tool preference, hiring, compensation, law, and market facts as time-sensitive. Route them through `research-game-design-jobs` and require primary sources with retrieval dates.

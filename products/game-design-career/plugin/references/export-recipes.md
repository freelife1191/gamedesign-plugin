# Career export recipes

Canonical validation must pass before derivative preparation. Every recipe produces the same renderer-neutral job shape; the selected renderer is execution evidence, not part of the content model.

## Document recipes

| Document type | Canonical emphasis | Derivative intent |
| --- | --- | --- |
| `learning-plan` | target requirement, task, owner, cadence, proof, re-evaluation | A working plan with explicit provisional durations and evidence gates. |
| `portfolio` | recruiter-inspectable problem, judgment, implementation, evidence, result, retrospective | A short recruiter path plus deeper case-study evidence. |
| `reverse-design` | observation, inference, confidence, counterexample, alternative, validation | A falsifiable analysis with facts separated from inference. |
| `review` | stable section/evidence IDs, observation state, prioritized minimum repair | An evidence-qualified review record. |
| `interview-report` | question evidence IDs, answer feedback, honest-answer tasks | A practice report without invented experience or results. |
| `transition-report` | current evidence, posting evidence, gaps, alternatives, next proof | A bounded transition decision record without a hiring promise. |

## Job manifest

Record `artifactRoot`, `artifactId`, `documentType`, canonical validation evidence, and exactly four format jobs: `md`, `pdf`, `docx`, and `pptx`. Each format keeps `requested`, `availability`, `status`, and `evidence` separate.

`unknown` means no capability probe ran. `unavailable` means a probe ran and proved the capability absent. `passed` means capability, generation, file existence, and format-appropriate QA all passed. Never collapse unknown, unavailable, and passed into one boolean.

Evidence records use `kind` (`capability-probe`, `generation`, or `qa`), exact `command`, optional safe artifact-relative `file`, and `result`. Generation and QA evidence require a file. An unavailable state requires failed capability-probe evidence.

The job, canonical validation, formats container, each format, every evidence item, and every PPTX slide are closed schemas. Reject unknown keys, dangerous prototype keys, and aliases such as `output`, `path`, or alternate command fields. Normalize by constructing a new object from approved fields only.

## Exact state transitions

| Status | Requested | Availability | Exact evidence |
| --- | --- | --- | --- |
| `not-requested` | false | `unknown` | none |
| `blocked` | true | `unknown` | none |
| `pending` | true | `unknown` or `available` | none while unknown; passed probe and optionally passed generation while available |
| `passed` | true | `available` | passed probe, passed generation, and passed QA |
| `failed` | true | `available` | passed probe plus failed generation and no QA, or passed generation plus failed QA |
| `unavailable` | true | `unavailable` | failed probe only |

Probe results are mutually exclusive. Generation and QA must reference one identical derivative path whose extension matches the requested format. A `passed` job rejects any failed probe, generation, or QA record.

## Format recipes

| Format | Preparation | Passed gate |
| --- | --- | --- |
| `md` | Preserve the canonical semantic structure and relative assets. | Generation/file evidence plus Markdown validation. |
| `pdf` | Select a renderer without changing canonical content. | Text-semantic comparison and rendered-page visual QA. |
| `docx` | Map canonical hierarchy and assets to OOXML. | Package/relationship validation, semantic comparison, and rendered-page visual QA. |
| `pptx` | Define audience, purpose, and a nonempty story outline before generation. | Slide overflow checks and rendered-slide visual QA. |

PPTX uses an independent story, not copied Markdown headings. The outline is authored for the audience and purpose, gives every slide a distinct message, and may link back to deeper canonical sections without turning each heading into a slide.

MD/PDF/DOCX/PPTX requests are not successful outputs. Generation and format-appropriate verification must both complete before `passed`.

## Failure behavior

- Fail closed when canonical validation is not passed or lacks command, file, and verification evidence.
- Preserve `unknown` when no capability probe ran.
- Use `unavailable` only with failed probe evidence; use `failed` only after generation or QA reports a defect.
- Reject absolute paths, parent traversal, and evidence files that resolve outside the artifact root.
- Preserve the canonical artifact and return the blocked format plus resumable next action.

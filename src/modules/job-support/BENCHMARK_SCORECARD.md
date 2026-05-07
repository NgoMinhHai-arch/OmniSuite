# Job Support Repo Benchmark Scorecard

Date: 2026-05-06

Candidates evaluated:
- `humancto/mr-jobs`
- `DaKheera47/job-ops`
- `olyaiy/resume-lm`
- `workopia/ai-resume-tailor`

Scoring model (1-10 each, weighted):
- Product fit for multi-platform search + automation (30%)
- Integration fit with OmniSuite stack (20%)
- Reliability/operability signals (20%)
- Safety controls for apply workflows (20%)
- Licensing/commercial flexibility (10%)

## Results

| Candidate | Product fit | Integration fit | Reliability | Safety | License fit | Weighted score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `mr-jobs` | 10 | 8 | 8 | 9 | 9 (MIT) | **8.9** |
| `job-ops` | 8 | 7 | 8 | 8 | 4 (AGPL + Commons Clause) | **7.4** |
| `resume-lm` | 7 | 6 | 7 | 8 | 5 (AGPLv3) | **6.8** |
| `ai-resume-tailor` | 8 | 9 | 7 | 9 | 9 (MIT) | **8.3** |

## Recommendation

- Primary foundation (Find Jobs + Auto Apply): **`mr-jobs`**
- Secondary module (Tailor CV/ATS): **`ai-resume-tailor`**

Rationale:
- `mr-jobs` is the strongest end-to-end automation platform with discovery, scoring, tailoring, browser automation, and tracking.
- `ai-resume-tailor` is focused, lightweight, and MIT-licensed, making it safer/easier as a CV specialization module.
- This pairing maximizes capability while reducing legal/commercial constraints from AGPL + Commons Clause options.

## Reuse vs Build in OmniSuite

Reuse:
- Discovery and apply orchestration concepts from `mr-jobs`
- Tailoring API flow from `ai-resume-tailor`

Build in OmniSuite:
- Unified domain contracts and error model
- Guardrails (dry-run default, approval gate, rate limits)
- OmniSuite-first UI workflow and reporting

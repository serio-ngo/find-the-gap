import type { Deck, Wave } from '../engine.ts'

const sandbox = 'serio-ngo/lifecycle-sandbox'
export const sandboxUrl = `https://github.com/${sandbox}`
export const sandboxApi = `repos/${sandbox}`

export type Origin = { url: string; quote: string }
export type StageName = 'spec-review' | 'write-tests' | 'deliver' | 'gate' | 'pr-loop'
export type StageRecord = {
  pr: number
  stage: StageName
  run: number
  url: string
  conclusion: string
  steps: string[]
}
export type ChoiceRecord = {
  clue: string
  marks: string[]
  sources: Origin[]
  stages: StageRecord[]
  context?: Origin
  constructed?: boolean
}

export type JobStep = { number: number; name: string; conclusion: string }
const stepText = ({ number, name, conclusion }: JobStep) => `${number}. ${name} · ${conclusion}`

const step = (number: number, name: string, conclusion = 'success'): JobStep => ({ number, name, conclusion })
const setup = step(1, 'Set up job')
const checkout = 'Run actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
const node = 'Run actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1'
const agent = 'Run anthropics/claude-code-action@4fa93a88de49bbef68b10eb15aabedf28ca0e1ed'
const appToken = 'Run actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510'
const upload = 'Run actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9'
const download = 'Run actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333'
const post = (number: number, name: string, conclusion = 'success') => step(number, 'Post ' + name, conclusion)
const finished = (number: number) => step(number, 'Complete job')
const publish = (review: boolean) => {
  const approved = review ? 'success' : 'skipped'
  const push = review ? 'skipped' : 'success'
  return [
    setup, step(2, checkout), step(3, 'Publish the spec review', approved),
    step(4, appToken, push), step(5, download, push), step(6, "Push the run's commits", push),
    step(7, 'Park a run without a push', push), step(8, 'Park a failed run', 'skipped'),
    ...(review ? [] : [post(15, appToken)]), post(16, checkout), finished(17),
  ]
}
const agentSteps = [
  setup, step(2, 'Run gh api "users/${SLUG}%5Bbot%5D" --jq \'"id=\\(.id)"\' >> "$GITHUB_OUTPUT"'),
  step(3, checkout), step(4, node), step(5, 'Install dependencies'), step(6, 'Install browsers'),
  step(7, 'Plugin at the pinned ref'), step(8, 'Ponytail at the pinned commit'), step(9, 'Brief'),
  step(10, 'Run tools="$WRITE"; extra="--append-system-prompt \\"$NOTE\\""; model="--model $MODEL"'),
  step(11, 'Run token="$(printf \'%s\' "$TOKEN" | tr -d \'[:space:]\')"'),
  step(12, agent), step(13, 'Trace'), step(14, 'Hand the commits to the publish job'),
  step(15, upload), step(16, upload), step(17, 'Fail a run without a finished result', 'skipped'),
  post(32, agent), post(33, node), post(34, checkout), finished(35),
]
const specSteps = publish(true)
const publishSteps = publish(false)
const lockSteps = [
  setup, step(2, checkout), step(3, download), step(4, 'Test lock'), step(5, 'Acceptance report'),
  step(6, 'Tests job', 'skipped'), post(12, checkout), finished(13),
]
const failureSteps = [
  setup, step(2, checkout), step(3, node), step(4, 'Install dependencies'), step(5, 'Gates'),
  step(6, 'Unit tests', 'failure'), step(7, 'Install browsers'), step(8, 'e2e tests', 'failure'),
  step(9, upload), step(10, upload), post(19, node, 'skipped'), post(20, checkout), finished(21),
]
const job = (pr: number, stage: StageName, run: number, id: number, name: string, steps: JobStep[], conclusion = 'success') => ({
  pr, stage, run, id, name, conclusion, steps,
})

export const regressionJobId = 134745629329

export const workflowJobs = [
  job(22, 'spec-review', 44398856995, 135136653041, 'agent / publish', specSteps),
  job(22, 'write-tests', 44399126363, 135137129288, 'agent / write-tests', agentSteps),
  job(22, 'deliver', 44410184015, 135180974191, 'agent / publish', publishSteps),
  job(22, 'gate', 44411666642, 135181396762, 'gate / lock and acceptance', lockSteps),
  job(20, 'spec-review', 44284426911, 134734023933, 'agent / publish', specSteps),
  job(20, 'write-tests', 44286903547, 134741889564, 'agent / write-tests', agentSteps),
  job(20, 'deliver', 44287400319, 134744541517, 'agent / publish', publishSteps),
  job(20, 'gate', 44288017206, regressionJobId, 'gate / tests', failureSteps, 'failure'),
  job(20, 'pr-loop', 44288184249, 134746341603, 'agent / pr-loop', agentSteps),
  job(20, 'gate', 44288595622, 134747883375, 'gate / lock and acceptance', lockSteps),
]

export const workflowStages = (pr: number): StageRecord[] => workflowJobs.filter((j) => j.pr === pr).map((j) => ({
  pr: j.pr, stage: j.stage, run: j.run, url: `${sandboxUrl}/actions/runs/${j.run}/job/${j.id}`,
  conclusion: j.conclusion, steps: j.steps.map(stepText),
}))

export const choiceRecords = (deck: Deck, wave: Wave): ChoiceRecord[] =>
  deck.choiceRecords?.(wave) ?? wave.symbols.map((clue) => ({ clue, marks: [clue], sources: [], stages: [] }))

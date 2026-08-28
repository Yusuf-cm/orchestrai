# Workflows

Workflows are YAML files in `backend/src/workflows/`. They are parsed, validated, and cached once at startup.

**If validation fails, the server refuses to start.** A workflow referencing an unknown condition or a missing step would leave real cases stranded with no error, so that failure happens at boot instead.

## Shape

```yaml
workflow:
  id: gov.ke_id_replacement_v1
  version: "1.0.0"
  domain: government
  adapter: gov-adapter-v1
  institution: ecitizen-ke
  title: Replace a lost national ID

  slots:
    - name: county
      type: string
      required: true

  steps:
    - id: intake_confirm
      type: collect_input
      mode: assist
      title: Confirm a few details
      description: Shown to the person verbatim.
      transitions:
        - to: resolve_requirements
          when: slots_filled:county
```

The first step is where a case begins. A step with no `transitions` is terminal.

## Step types

Only these are implemented. Using anything else fails validation.

| Type | Purpose | Runs automatically |
|---|---|---|
| `collect_input` | Gather slot values | No |
| `ask_question` | Single follow-up | No |
| `lookup` | Fetch requirements, offices, facilities | Yes |
| `validate` | Compute eligibility, triage, readiness | Yes |
| `document_required` | Require documents or confirmations | No |
| `guide_user` | Instructions for a real-world action | No |
| `assist_user` | System prepares, person submits | No |
| `appointment` | Record a planned visit | No |
| `payment` | Fee and payment channel | No |
| `human_handoff` | Route to a person | No |
| `completion` | Terminal success | — |

## Execution modes

Every step declares one. The execution layer enforces it.

| Mode | Meaning |
|---|---|
| `guide` | The person acts; Waypoint tells them exactly what is needed |
| `assist` | Waypoint prepares the work; the person submits it |
| `execute` | Waypoint acts. Anything touching the outside world needs authorisation first |
| `escalate` | Handed to a person. Cannot be advanced automatically |

## Condition grammar

`when` accepts only these forms. Anything else is rejected at load time.

| Condition | True when |
|---|---|
| `always` | Unconditionally |
| `slots_filled:a,b` | Every named slot has a non-empty value |
| `requirements_satisfied` | Every mandatory requirement is satisfied |
| `requirements_pending` | At least one mandatory requirement is outstanding |
| `readiness >= 60` | Comparison holds. Operators: `>=` `<=` `>` `<` `==` |
| `slot:name` | Slot is truthy |
| `slot:name == value` | Slot equals value |
| `flag:name` | Case carries the flag |
| `appointment_scheduled` | A scheduled appointment exists |
| `user_confirmed` | The person confirmed the current step |

Transitions are evaluated in order and the first match wins, so put specific conditions above general ones:

```yaml
transitions:
  - to: emergency_redirect
    when: slot:care_level == emergency
  - to: check_cover
    when: slot:care_level
```

## Confirmation authorises one transition

`user_confirmed` is cleared by the engine immediately after a transition. One confirmation moves the case exactly one step — a tap on "Done" cannot cascade through several steps.

## Handlers

`lookup` and `validate` steps name a handler that the adapter implements:

```yaml
- id: resolve_requirements
  type: lookup
  mode: execute
  handler: gov.resolveRequirements
```

Handlers return data rather than mutating the case:

```typescript
{
  success: boolean;
  output?: Record<string, unknown>;   // merged into slots
  requirements?: Requirement[];       // replaces the requirement list
  flags?: string[];                   // added to case flags
  error?: string;
}
```

Anything a handler puts in `output` lands in `workflow.slots` and is available to conditions and to the interface.

## How the interface uses this

The frontend renders from `currentStep.type` and `currentStep.mode`, plus whatever handlers left in slots. It contains no step names. Adding a step, or an entire domain, needs no frontend change.

`title` and `description` are shown to the person as written, so write them as copy rather than as labels.

## Validation rules

At load time each workflow must satisfy:

- `id` present, at least one step
- Every `type` implemented
- Every transition target exists
- Every `when` parses under the grammar above
- At least one terminal step

Terminal steps may omit `transitions`; the loader normalises it to an empty list.

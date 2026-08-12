---
team: fern-ware
week: 9
date: 2026-08-12
members:
  - name: Rithvik Kommareddy
    github: rkommare
    hat: Data&Eval
  - name: Joseph Kutza
    github: jkutza
    hat: Product
  - name: Zachary Hamilton
    github: Zachary-E-Hamilton
    hat: Engineering
north_star:
  metric: Total Parsing Accuracy
  value: .68
  previous: .5687
---

## Shipped this week
- Started finetuning the parser. Only trained for one epoch, but proved that the entire training and evaluation framework functions and a slight improvement was achieved  (evidence: commit edab4fb)

## User / validation learning
- Additional considerations from prospective users was analyzed, resulting in a strong list of features we are considering for the final product

## Metrics snapshot
- Total Parsing Accuracy: .68 (was .5687)

## Challenges / blockers
- The finetuning is extremely slow

## Next week's goal
- Finish finetuning the parser
- Refine user interface and add features

## Individual contributions
- Rithvik (Data&Eval): Trained and evaluated parser  (evidence: commit edab4fb)
- Zach (Engineering): Fixed issue with plant database sometimes not loading in time, improved parsing speed by running multiple in parallel  (evidence: 50afc8d)
- <name> (<hat>): <what they did>  (evidence: ...)

## Lean canvas changes (if any)
- <what shifted this week: user, problem, value proposition, cost, or risk>

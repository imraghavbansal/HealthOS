-- Raag — V2: curated medication interaction checker
--
-- NLM discontinued RxNav's Drug-Drug Interaction API on 2024-01-02 (the
-- rest of RxNav — name normalization, RxClass — is still live, just not
-- the interaction endpoint). DrugBank's free non-commercial API requires
-- signup approval and is itself retiring in 2026. Rather than build
-- against a discontinued API or unreliable label-text scraping (openFDA),
-- this ships a curated, static table of well-documented major
-- interactions instead — deterministic, no external dependency, no rate
-- limits, no risk of another shutdown. Matches the product's existing
-- "deterministic, cite sources, never overclaim" pattern (see
-- 0009_insights_engine.sql). **Explicitly not exhaustive** — the app
-- surfaces that caveat everywhere this data is shown; it covers ~25
-- well-established major interaction pairs, not a full clinical
-- database, and always recommends pharmacist/doctor review.
--
-- Reference data, not user data: readable by any authenticated user (no
-- subject scoping — everyone sees the same rule set), writable by
-- nobody through the API (only this migration seeds it; expanding the
-- list is a future migration, not a user action).

create table drug_interaction_rules (
  id uuid primary key default gen_random_uuid(),
  drug_a text not null,
  drug_a_aliases text[] not null,
  drug_b text not null,
  drug_b_aliases text[] not null,
  severity text not null check (severity in ('moderate', 'major', 'contraindicated')),
  description text not null,
  recommendation text not null,
  source text not null,
  created_at timestamptz not null default now()
);

alter table drug_interaction_rules enable row level security;

create policy drug_interaction_rules_select on drug_interaction_rules for select using (true);
-- no insert/update/delete policy: append-only via migration, same as audit_log's pattern

insert into drug_interaction_rules (drug_a, drug_a_aliases, drug_b, drug_b_aliases, severity, description, recommendation, source) values
  ('Warfarin', array['warfarin', 'coumadin'], 'Aspirin', array['aspirin', 'acetylsalicylic acid'],
    'major', 'Combined use significantly increases bleeding risk.', 'Requires close monitoring by a doctor; do not combine without medical supervision.', 'FDA label — Warfarin boxed warning'),
  ('Warfarin', array['warfarin', 'coumadin'], 'Ibuprofen', array['ibuprofen', 'advil', 'motrin'],
    'major', 'NSAIDs increase bleeding risk when combined with warfarin.', 'Avoid NSAIDs while on warfarin; use acetaminophen for pain if approved by your doctor.', 'FDA label — Warfarin boxed warning'),
  ('Warfarin', array['warfarin', 'coumadin'], 'Amiodarone', array['amiodarone', 'cordarone', 'pacerone'],
    'major', 'Amiodarone can significantly increase warfarin''s blood-thinning effect.', 'Requires dose adjustment and closer INR monitoring — doctor supervision required.', 'FDA label — Amiodarone'),
  ('Aspirin', array['aspirin', 'acetylsalicylic acid'], 'Ibuprofen', array['ibuprofen', 'advil', 'motrin'],
    'moderate', 'Ibuprofen can reduce aspirin''s cardioprotective (antiplatelet) effect and adds bleeding risk.', 'If both are needed, ask your doctor about timing and whether an alternative pain reliever is safer.', 'FDA drug interaction guidance'),
  ('Lisinopril', array['lisinopril', 'ace inhibitor', 'enalapril', 'ramipril'], 'Spironolactone', array['spironolactone', 'aldactone'],
    'major', 'Combining an ACE inhibitor with a potassium-sparing diuretic can cause dangerously high potassium (hyperkalemia).', 'Requires regular potassium/kidney-function monitoring by a doctor.', 'FDA label — ACE inhibitor class warning'),
  ('Lisinopril', array['lisinopril', 'ace inhibitor', 'enalapril', 'ramipril'], 'Ibuprofen', array['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve'],
    'moderate', 'NSAIDs can reduce the blood-pressure-lowering effect of ACE inhibitors and stress the kidneys.', 'Use the lowest effective NSAID dose for the shortest time, or ask about acetaminophen instead.', 'FDA drug interaction guidance'),
  ('Sertraline', array['sertraline', 'zoloft', 'ssri', 'fluoxetine', 'prozac', 'escitalopram', 'lexapro', 'paroxetine', 'paxil'], 'Tramadol', array['tramadol', 'ultram'],
    'major', 'Combining an SSRI with tramadol raises the risk of serotonin syndrome, a potentially life-threatening condition.', 'Seek immediate medical attention for agitation, rapid heart rate, high fever, or muscle rigidity.', 'FDA label — Tramadol serotonin syndrome warning'),
  ('Sertraline', array['sertraline', 'zoloft', 'ssri', 'fluoxetine', 'prozac', 'escitalopram', 'lexapro', 'paroxetine', 'paxil'], 'Phenelzine', array['phenelzine', 'nardil', 'maoi', 'tranylcypromine', 'parnate'],
    'contraindicated', 'Combining an SSRI with an MAOI can cause life-threatening serotonin syndrome — this combination should never be taken together.', 'Do not combine. A washout period of at least 2 weeks is typically required when switching between these classes — doctor supervision required.', 'FDA label — MAOI/SSRI contraindication'),
  ('Simvastatin', array['simvastatin', 'zocor', 'statin', 'atorvastatin', 'lipitor'], 'Clarithromycin', array['clarithromycin', 'biaxin', 'erythromycin'],
    'major', 'These antibiotics can raise statin levels significantly, increasing the risk of muscle damage (rhabdomyolysis).', 'Your doctor may pause the statin during the antibiotic course or choose an alternative antibiotic.', 'FDA label — Statin drug interaction warning'),
  ('Simvastatin', array['simvastatin', 'zocor', 'statin', 'atorvastatin', 'lipitor'], 'Fluconazole', array['fluconazole', 'diflucan', 'itraconazole', 'ketoconazole'],
    'major', 'Antifungals in this class can raise statin levels, increasing the risk of muscle damage.', 'Ask your doctor about pausing the statin during antifungal treatment.', 'FDA label — Statin drug interaction warning'),
  ('Metformin', array['metformin', 'glucophage'], 'Furosemide', array['furosemide', 'lasix'],
    'moderate', 'Loop diuretics can affect blood sugar control and kidney function relevant to metformin dosing.', 'Routine kidney-function monitoring is recommended when combined.', 'FDA drug interaction guidance'),
  ('Digoxin', array['digoxin', 'lanoxin'], 'Furosemide', array['furosemide', 'lasix', 'hydrochlorothiazide', 'hctz'],
    'major', 'Diuretics can lower potassium, which increases the risk of digoxin toxicity (dangerous heart rhythm effects).', 'Requires regular potassium and digoxin-level monitoring by a doctor.', 'FDA label — Digoxin toxicity warning'),
  ('Digoxin', array['digoxin', 'lanoxin'], 'Amiodarone', array['amiodarone', 'cordarone', 'pacerone'],
    'major', 'Amiodarone can significantly raise digoxin blood levels, increasing toxicity risk.', 'Digoxin dose is typically reduced when starting amiodarone — doctor supervision required.', 'FDA label — Digoxin toxicity warning'),
  ('Lithium', array['lithium', 'lithobid'], 'Ibuprofen', array['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve'],
    'major', 'NSAIDs can raise lithium levels into the toxic range.', 'Avoid NSAIDs if possible; acetaminophen is generally a safer option — confirm with your doctor.', 'FDA label — Lithium toxicity warning'),
  ('Lithium', array['lithium', 'lithobid'], 'Hydrochlorothiazide', array['hydrochlorothiazide', 'hctz', 'furosemide', 'lasix'],
    'major', 'Diuretics reduce lithium clearance, increasing the risk of lithium toxicity.', 'Requires closer lithium-level monitoring by a doctor.', 'FDA label — Lithium toxicity warning'),
  ('Methotrexate', array['methotrexate', 'trexall'], 'Ibuprofen', array['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve'],
    'major', 'NSAIDs can reduce methotrexate clearance, raising the risk of toxicity, especially at higher methotrexate doses.', 'Discuss any NSAID use with the prescriber managing your methotrexate.', 'FDA label — Methotrexate drug interaction warning'),
  ('Clopidogrel', array['clopidogrel', 'plavix'], 'Omeprazole', array['omeprazole', 'prilosec', 'esomeprazole', 'nexium'],
    'moderate', 'Certain PPIs can reduce how well clopidogrel is activated in the body, potentially reducing its antiplatelet effect.', 'Ask your doctor whether an alternative acid reducer (e.g. pantoprazole) is preferable.', 'FDA label — Clopidogrel drug interaction warning'),
  ('Alprazolam', array['alprazolam', 'xanax', 'benzodiazepine', 'lorazepam', 'ativan', 'diazepam', 'valium', 'clonazepam', 'klonopin'], 'Oxycodone', array['oxycodone', 'oxycontin', 'hydrocodone', 'vicodin', 'tramadol', 'ultram', 'morphine'],
    'contraindicated', 'Combining benzodiazepines with opioids significantly increases the risk of profound sedation, slowed/stopped breathing, coma, and death.', 'This combination carries an FDA boxed warning. Seek immediate medical attention for slow/shallow breathing or unusual drowsiness.', 'FDA boxed warning — Benzodiazepines and opioids'),
  ('Sildenafil', array['sildenafil', 'viagra', 'tadalafil', 'cialis'], 'Isosorbide', array['isosorbide', 'nitroglycerin', 'nitrate'],
    'contraindicated', 'Combining these can cause a severe, life-threatening drop in blood pressure.', 'Do not combine under any circumstances — this is an absolute contraindication.', 'FDA label — PDE5 inhibitor nitrate contraindication'),
  ('Levothyroxine', array['levothyroxine', 'synthroid'], 'Calcium', array['calcium', 'calcium carbonate', 'tums', 'iron', 'ferrous sulfate'],
    'moderate', 'Calcium and iron supplements can significantly reduce levothyroxine absorption.', 'Separate dosing by at least 4 hours.', 'FDA label — Levothyroxine absorption warning'),
  ('Ciprofloxacin', array['ciprofloxacin', 'cipro', 'levofloxacin', 'fluoroquinolone'], 'Calcium', array['calcium', 'calcium carbonate', 'tums', 'iron', 'ferrous sulfate', 'antacid'],
    'moderate', 'Calcium, iron, and antacids can significantly reduce fluoroquinolone antibiotic absorption.', 'Separate dosing by at least 2 hours before or 6 hours after.', 'FDA label — Fluoroquinolone absorption warning'),
  ('Warfarin', array['warfarin', 'coumadin'], 'Ciprofloxacin', array['ciprofloxacin', 'cipro', 'levofloxacin', 'fluoroquinolone', 'metronidazole', 'flagyl'],
    'major', 'These antibiotics can significantly increase warfarin''s blood-thinning effect.', 'Requires closer INR monitoring during and after the antibiotic course.', 'FDA label — Warfarin drug interaction warning'),
  ('Metoprolol', array['metoprolol', 'lopressor', 'toprol', 'beta blocker', 'atenolol', 'propranolol'], 'Verapamil', array['verapamil', 'calan', 'diltiazem', 'cardizem'],
    'major', 'Combining these can cause dangerously slow heart rate and low blood pressure.', 'Requires cardiologist supervision if both are medically necessary.', 'FDA label — Beta-blocker/calcium-channel-blocker interaction'),
  ('Prednisone', array['prednisone', 'corticosteroid', 'prednisolone', 'methylprednisolone'], 'Ibuprofen', array['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'aspirin'],
    'moderate', 'Combining corticosteroids with NSAIDs increases the risk of stomach ulcers and GI bleeding.', 'Consider a stomach-protective medication if both are needed long-term — ask your doctor.', 'FDA drug interaction guidance'),
  ('Sertraline', array['sertraline', 'zoloft', 'ssri', 'fluoxetine', 'prozac', 'citalopram', 'celexa'], 'Aspirin', array['aspirin', 'ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'warfarin'],
    'moderate', 'SSRIs can increase bleeding risk on their own; combined with NSAIDs/aspirin/warfarin this risk compounds.', 'Watch for unusual bruising or bleeding and mention this combination to your doctor.', 'FDA drug interaction guidance');

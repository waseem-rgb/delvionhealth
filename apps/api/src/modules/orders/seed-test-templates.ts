import { PrismaService } from "../../prisma/prisma.service";
import { NAME_KEYWORD_MATCHES } from "./seed-report-parameters";

// Template data interfaces
export interface ParameterTemplate {
  name: string;
  clinicalNote: string;
  abnormalityNote: { direction: "LOW" | "HIGH"; reasons: string[] }[];
  footerNote?: string;
}

export interface TestTemplate {
  testCode: string;
  reportTitle: string;
  reportIntro: string;
  reportConclusion: string;
  parameters: ParameterTemplate[];
}

// All test template data
export const TEST_TEMPLATES: TestTemplate[] = [
  // ═══ CBC (PT0242) ═══════════════════════════════════════════════════
  {
    testCode: "PT0242",
    reportTitle: "Complete Blood Count (CBC) with Differential",
    reportIntro:
      "The Complete Blood Count (CBC) is one of the most commonly ordered blood tests. It evaluates the three major types of cells in the blood: red blood cells (which carry oxygen), white blood cells (which fight infection), and platelets (which help blood clot). The CBC with differential provides additional detail on the types of white blood cells present. This panel is essential for screening, diagnosing, and monitoring a wide range of conditions including infections, anaemia, clotting disorders, and blood cancers.",
    reportConclusion:
      "Results should be interpreted in conjunction with clinical history and physical examination. Abnormal values may warrant repeat testing, peripheral blood smear review, or further specialised investigations as clinically indicated.",
    parameters: [
      {
        name: "Hemoglobin (Hb)",
        clinicalNote:
          "Haemoglobin is the protein inside red blood cells that carries oxygen from your lungs to all parts of your body. This measurement tells your doctor how well your blood can transport oxygen. It is one of the most important indicators of overall blood health.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Iron deficiency anaemia",
              "Vitamin B12 or folate deficiency",
              "Chronic kidney disease (reduced erythropoietin)",
              "Bone marrow disorders (aplastic anaemia, leukaemia)",
              "Chronic blood loss (gastrointestinal bleeding, heavy menstruation)",
              "Thalassaemia or other haemoglobinopathies",
              "Chronic inflammatory diseases",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Polycythaemia vera",
              "Chronic hypoxia (COPD, high altitude living)",
              "Dehydration (relative increase)",
              "Heavy smoking (carboxyhaemoglobin compensation)",
              "Erythropoietin-secreting tumours",
            ],
          },
        ],
      },
      {
        name: "Hematocrit (Hct)",
        clinicalNote:
          "Haematocrit measures the percentage of your blood volume that is made up of red blood cells. It provides a quick assessment of oxygen-carrying capacity and blood viscosity. Changes often mirror haemoglobin trends.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Anaemia of any cause",
              "Overhydration or excess intravenous fluids",
              "Bone marrow failure",
              "Chronic blood loss",
              "Nutritional deficiencies (iron, B12, folate)",
              "Haemolytic anaemia",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Dehydration",
              "Polycythaemia vera",
              "Chronic lung disease",
              "Living at high altitude",
              "Congenital heart disease",
            ],
          },
        ],
      },
      {
        name: "Red Blood Cell Count (RBC)",
        clinicalNote:
          "The red blood cell count measures the total number of red blood cells in a sample of your blood. Red blood cells are responsible for delivering oxygen to tissues and removing carbon dioxide. This count helps evaluate conditions that affect red blood cell production or destruction.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Iron deficiency anaemia",
              "Vitamin B12 or folate deficiency (megaloblastic anaemia)",
              "Bone marrow suppression (chemotherapy, radiation)",
              "Chronic kidney disease",
              "Haemolytic anaemia (autoimmune, mechanical)",
              "Acute or chronic blood loss",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Polycythaemia vera",
              "Chronic hypoxia (COPD, sleep apnoea)",
              "Dehydration (haemoconcentration)",
              "High altitude acclimatisation",
              "Erythropoietin abuse or secreting tumours",
            ],
          },
        ],
      },
      {
        name: "Mean Corpuscular Volume (MCV)",
        clinicalNote:
          "MCV measures the average size of your red blood cells. It is a key tool for classifying anaemias. Small red blood cells (microcytic) suggest iron deficiency, while large red blood cells (macrocytic) may indicate vitamin deficiencies or other conditions.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Iron deficiency anaemia",
              "Thalassaemia trait or disease",
              "Anaemia of chronic disease (some cases)",
              "Sideroblastic anaemia",
              "Lead poisoning",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Vitamin B12 deficiency",
              "Folate deficiency",
              "Alcoholism and liver disease",
              "Myelodysplastic syndromes",
              "Reticulocytosis (increased immature red cells)",
              "Hypothyroidism",
              "Certain medications (methotrexate, hydroxyurea)",
            ],
          },
        ],
      },
      {
        name: "Mean Corpuscular Hemoglobin (MCH)",
        clinicalNote:
          "MCH indicates the average amount of haemoglobin inside each red blood cell. It is closely related to MCV and helps classify the type of anaemia present. Low MCH typically accompanies small, pale red blood cells.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Iron deficiency anaemia",
              "Thalassaemia",
              "Chronic disease anaemia",
              "Sideroblastic anaemia",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Vitamin B12 deficiency",
              "Folate deficiency",
              "Macrocytic anaemia of any cause",
              "Hereditary spherocytosis",
            ],
          },
        ],
      },
      {
        name: "Mean Corpuscular Hemoglobin Concentration (MCHC)",
        clinicalNote:
          "MCHC represents the average concentration of haemoglobin in a given volume of red blood cells. It describes how densely packed the haemoglobin is within each cell and is useful for confirming the type of anaemia.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Iron deficiency anaemia (hypochromic cells)",
              "Thalassaemia",
              "Sideroblastic anaemia",
              "Chronic blood loss",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hereditary spherocytosis",
              "Autoimmune haemolytic anaemia",
              "Severe dehydration",
              "Cold agglutinin disease (artefact)",
            ],
          },
        ],
      },
      {
        name: "Red Cell Distribution Width (RDW)",
        clinicalNote:
          "RDW measures the variation in size among your red blood cells. A higher RDW means there is a wide range of red blood cell sizes, which can help distinguish between different types of anaemia and guide further investigation.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Generally not clinically significant",
              "May be seen with homogeneous red cell populations",
              "Can occur in thalassaemia minor (uniform small cells)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Iron deficiency anaemia (early sign)",
              "Mixed nutritional deficiency (iron + B12)",
              "Myelodysplastic syndromes",
              "Post blood transfusion (mixed cell populations)",
              "Reticulocytosis",
              "Sickle cell disease",
            ],
          },
        ],
      },
      {
        name: "White Blood Cell Count (WBC)",
        clinicalNote:
          "White blood cells are the body's primary defence against infections, allergens, and foreign substances. The WBC count measures the total number of infection-fighting cells in your blood. It is a fundamental marker for detecting infections, immune disorders, and blood cancers.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Viral infections (HIV, hepatitis, influenza)",
              "Bone marrow suppression (chemotherapy, radiation)",
              "Autoimmune disorders (lupus)",
              "Aplastic anaemia",
              "Severe sepsis (marrow exhaustion)",
              "Certain medications (immunosuppressants, antibiotics)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Bacterial infections",
              "Inflammatory conditions (rheumatoid arthritis, IBD)",
              "Leukaemia or lymphoma",
              "Severe physiological stress or trauma",
              "Corticosteroid therapy",
              "Allergic reactions",
              "Smoking",
            ],
          },
        ],
      },
      {
        name: "Neutrophils (%)",
        clinicalNote:
          "Neutrophils are the most abundant type of white blood cell and are the first responders to bacterial infections. This percentage tells your doctor what proportion of your white blood cells are neutrophils, helping to identify infections and inflammatory conditions.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Viral infections",
              "Bone marrow suppression or failure",
              "Autoimmune neutropenia",
              "Severe overwhelming sepsis",
              "Certain medications (clozapine, chemotherapy)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Acute bacterial infections",
              "Acute inflammation or tissue necrosis",
              "Physiological stress (surgery, burns)",
              "Corticosteroid use",
              "Chronic myeloid leukaemia",
              "Smoking",
            ],
          },
        ],
      },
      {
        name: "Lymphocytes (%)",
        clinicalNote:
          "Lymphocytes are white blood cells that play a central role in the immune system. They include T cells, B cells, and natural killer cells that fight viruses, produce antibodies, and destroy abnormal cells. Their percentage helps in evaluating immune function and infections.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "HIV/AIDS",
              "Corticosteroid therapy",
              "Severe acute illness or sepsis",
              "Autoimmune disorders (lupus)",
              "Radiation exposure",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Viral infections (EBV, CMV, hepatitis)",
              "Chronic lymphocytic leukaemia",
              "Pertussis (whooping cough)",
              "Tuberculosis",
              "Lymphoma",
            ],
          },
        ],
      },
      {
        name: "Monocytes (%)",
        clinicalNote:
          "Monocytes are white blood cells that migrate into tissues and become macrophages, engulfing and digesting pathogens, dead cells, and debris. An elevated monocyte percentage can indicate chronic infections, inflammatory conditions, or certain blood disorders.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Bone marrow failure",
              "Hairy cell leukaemia",
              "Glucocorticoid administration (acute)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Chronic infections (tuberculosis, endocarditis)",
              "Chronic inflammatory diseases",
              "Recovery phase after acute infection",
              "Chronic myelomonocytic leukaemia",
              "Autoimmune disorders",
            ],
          },
        ],
      },
      {
        name: "Eosinophils (%)",
        clinicalNote:
          "Eosinophils are white blood cells primarily involved in fighting parasitic infections and in allergic responses. Elevated levels often point to allergies, asthma, or parasitic infections. They also play a role in certain autoimmune conditions.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Acute stress response (cortisol surge)",
              "Cushing syndrome",
              "Corticosteroid therapy",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Allergic conditions (asthma, hay fever, eczema)",
              "Parasitic infections (hookworm, ascaris)",
              "Drug hypersensitivity reactions",
              "Eosinophilic oesophagitis",
              "Hypereosinophilic syndrome",
              "Churg-Strauss syndrome (eosinophilic granulomatosis)",
              "Certain lymphomas (Hodgkin disease)",
            ],
          },
        ],
      },
      {
        name: "Basophils (%)",
        clinicalNote:
          "Basophils are the least common type of white blood cell. They release histamine and other chemicals during allergic reactions and play a role in inflammation. Significantly elevated basophils can sometimes indicate myeloproliferative disorders.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Acute allergic reactions (transient depletion)",
              "Hyperthyroidism",
              "Acute stress or infection",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Chronic myeloid leukaemia",
              "Myeloproliferative neoplasms",
              "Chronic inflammatory conditions",
              "Hypothyroidism",
              "Ulcerative colitis",
            ],
          },
        ],
      },
      {
        name: "Platelet Count",
        clinicalNote:
          "Platelets are small cell fragments essential for blood clotting. They clump together at sites of blood vessel injury to stop bleeding. A platelet count helps assess your risk of excessive bleeding or abnormal clot formation.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Immune thrombocytopenic purpura (ITP)",
              "Bone marrow suppression (chemotherapy, leukaemia)",
              "Viral infections (dengue, HIV, hepatitis C)",
              "Disseminated intravascular coagulation (DIC)",
              "Hypersplenism",
              "Liver cirrhosis",
              "Certain medications (heparin-induced thrombocytopenia)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Iron deficiency anaemia (reactive)",
              "Chronic infections or inflammation",
              "Post-splenectomy",
              "Essential thrombocythaemia",
              "Polycythaemia vera",
            ],
          },
        ],
      },
      {
        name: "Mean Platelet Volume (MPV)",
        clinicalNote:
          "MPV measures the average size of your platelets. Larger platelets are usually younger and more active. MPV can provide additional context when interpreting platelet count abnormalities and may help differentiate between causes of thrombocytopenia.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Bone marrow suppression with impaired production",
              "Aplastic anaemia",
              "Cytotoxic drug therapy",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Immune thrombocytopenic purpura (compensatory large platelets)",
              "Myeloproliferative disorders",
              "Bernard-Soulier syndrome",
              "Pre-eclampsia",
              "Hyperthyroidism",
            ],
          },
        ],
      },
      {
        name: "Neutrophils (Absolute)",
        clinicalNote:
          "The absolute neutrophil count (ANC) gives the actual number of neutrophils in your blood, which is more clinically meaningful than the percentage alone. It is the primary measure used to assess infection risk, especially in patients undergoing chemotherapy.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Chemotherapy-induced neutropenia",
              "Drug-induced agranulocytosis",
              "Severe viral infections",
              "Aplastic anaemia",
              "Autoimmune neutropenia",
              "Cyclic neutropenia",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Acute bacterial infections",
              "Acute myocardial infarction or tissue necrosis",
              "Metabolic acidosis (diabetic ketoacidosis)",
              "Chronic myeloid leukaemia",
              "Corticosteroid therapy",
            ],
          },
        ],
        footerNote:
          "An ANC below 500 cells/µL is considered severe neutropenia and carries a high risk of serious infection. Protective isolation and empiric antibiotics may be warranted.",
      },
      {
        name: "Lymphocytes (Absolute)",
        clinicalNote:
          "The absolute lymphocyte count provides the actual number of lymphocytes in your blood. It is useful for monitoring immune function, evaluating viral infections, and tracking patients with immune-related conditions or those on immunosuppressive therapy.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "HIV/AIDS",
              "Severe combined immunodeficiency (SCID)",
              "Corticosteroid or immunosuppressive therapy",
              "Late-stage sepsis",
              "Radiation therapy",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Viral infections (EBV, CMV, mumps)",
              "Chronic lymphocytic leukaemia",
              "Pertussis",
              "Acute lymphoblastic leukaemia",
              "Toxoplasmosis",
            ],
          },
        ],
      },
    ],
  },

  // ═══ Thyroid Profile I (PT0760) ═════════════════════════════════════
  {
    testCode: "PT0760",
    reportTitle: "Thyroid Profile I (T3, T4, TSH)",
    reportIntro:
      "The Thyroid Profile I measures the levels of the key thyroid hormones — Triiodothyronine (T3), Thyroxine (T4), and Thyroid Stimulating Hormone (TSH). The thyroid gland regulates metabolism, energy production, heart rate, body temperature, and many other vital functions. This panel helps screen for and diagnose thyroid disorders including hypothyroidism (underactive thyroid) and hyperthyroidism (overactive thyroid). It is also used to monitor patients who are on thyroid medication.",
    reportConclusion:
      "Thyroid results should be interpreted together rather than in isolation. Borderline results may require repeat testing after 6-8 weeks. Clinical correlation with symptoms such as fatigue, weight changes, heart rate abnormalities, and temperature intolerance is essential.",
    parameters: [
      {
        name: "T3 (Triiodothyronine)",
        clinicalNote:
          "T3 is the most active form of thyroid hormone and plays a critical role in regulating metabolism, heart function, and body temperature. Although present in smaller quantities than T4, it is several times more potent. Most T3 is produced by conversion of T4 in peripheral tissues.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Hypothyroidism",
              "Severe non-thyroidal illness (sick euthyroid syndrome)",
              "Malnutrition or starvation",
              "Chronic liver or kidney disease",
              "Certain medications (amiodarone, corticosteroids)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hyperthyroidism (Graves' disease, toxic nodular goitre)",
              "T3 thyrotoxicosis",
              "Early or mild hyperthyroidism",
              "Excessive thyroid hormone supplementation",
              "Pregnancy or oral contraceptive use (increased TBG)",
            ],
          },
        ],
      },
      {
        name: "T4 (Thyroxine)",
        clinicalNote:
          "T4 is the primary hormone produced by the thyroid gland. It circulates in the blood mostly bound to carrier proteins and is converted to the more active T3 in tissues. T4 levels reflect the overall output of the thyroid gland and are essential for diagnosing thyroid dysfunction.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Primary hypothyroidism (Hashimoto thyroiditis)",
              "Secondary hypothyroidism (pituitary insufficiency)",
              "Iodine deficiency",
              "Medications (lithium, anti-thyroid drugs)",
              "Post-thyroidectomy without adequate replacement",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hyperthyroidism (Graves' disease, toxic adenoma)",
              "Thyroiditis (subacute, postpartum — transient release)",
              "Excessive levothyroxine dosage",
              "Pregnancy (elevated TBG increases total T4)",
              "Acute psychiatric illness (transient)",
            ],
          },
        ],
      },
      {
        name: "TSH (Thyroid Stimulating Hormone)",
        clinicalNote:
          "TSH (Thyroid Stimulating Hormone) is produced by the pituitary gland and controls how much hormone the thyroid gland releases. It is the single most sensitive marker for thyroid dysfunction. TSH rises when the thyroid is underactive and falls when it is overactive.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Hyperthyroidism (Graves' disease, toxic multinodular goitre)",
              "Excessive thyroid hormone replacement",
              "Subclinical hyperthyroidism",
              "Central hypothyroidism (pituitary or hypothalamic disease)",
              "Non-thyroidal illness (euthyroid sick syndrome)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Primary hypothyroidism (Hashimoto thyroiditis, iodine deficiency)",
              "Subclinical hypothyroidism",
              "Inadequate thyroid hormone replacement dose",
              "TSH-secreting pituitary adenoma (rare)",
              "Recovery phase of non-thyroidal illness",
              "Thyroid hormone resistance syndrome",
            ],
          },
        ],
        footerNote:
          "Pregnancy TSH reference ranges differ by trimester: 1st trimester 0.1–2.5 µIU/mL, 2nd trimester 0.2–3.0 µIU/mL, 3rd trimester 0.3–3.5 µIU/mL. Interpret accordingly in pregnant patients.",
      },
    ],
  },

  // ═══ Thyroid Profile III (PT0761) ═══════════════════════════════════
  {
    testCode: "PT0761",
    reportTitle: "Thyroid Profile III (FT3, FT4, TSH)",
    reportIntro:
      "The Thyroid Profile III measures Free T3, Free T4, and TSH. Unlike total T3/T4, free hormone levels represent the biologically active fraction not bound to carrier proteins. This makes the test less affected by conditions that alter protein binding, such as pregnancy, oral contraceptive use, or liver disease. This profile provides a more accurate assessment of thyroid function in complex clinical situations.",
    reportConclusion:
      "Free thyroid hormone levels combined with TSH provide the most reliable assessment of thyroid function. Results should be interpreted alongside clinical symptoms, medication history, and any conditions known to affect thyroid hormone binding proteins.",
    parameters: [
      {
        name: "Free T3 (FT3)",
        clinicalNote:
          "Free T3 measures the unbound, biologically active form of triiodothyronine. Since only the free fraction enters cells and exerts metabolic effects, FT3 is more reflective of actual thyroid status than total T3, especially when binding protein levels are abnormal.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Hypothyroidism",
              "Sick euthyroid syndrome (non-thyroidal illness)",
              "Severe systemic illness",
              "Chronic malnutrition",
              "Medications (amiodarone, beta-blockers — impair T4 to T3 conversion)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hyperthyroidism (Graves' disease, toxic adenoma)",
              "T3 thyrotoxicosis",
              "Early hyperthyroidism (FT3 may rise before FT4)",
              "Over-replacement with liothyronine",
              "Thyroiditis (acute release)",
            ],
          },
        ],
      },
      {
        name: "Free T4 (FT4)",
        clinicalNote:
          "Free T4 measures the unbound thyroxine available to enter tissues and be converted to the active T3. It is one of the most important tests for diagnosing and monitoring thyroid disorders, as it is not significantly affected by changes in protein binding.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Primary hypothyroidism (Hashimoto thyroiditis)",
              "Secondary hypothyroidism (pituitary failure)",
              "Tertiary hypothyroidism (hypothalamic disease)",
              "Iodine deficiency",
              "Anti-thyroid medications (methimazole, PTU)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hyperthyroidism (Graves' disease, toxic nodular goitre)",
              "Excessive levothyroxine supplementation",
              "Thyroiditis with hormone release (subacute, painless)",
              "Factitious thyrotoxicosis",
              "Struma ovarii (rare ovarian teratoma producing thyroid hormone)",
            ],
          },
        ],
      },
      {
        name: "Thyroid Stimulating Hormone (TSH)",
        clinicalNote:
          "TSH (Thyroid Stimulating Hormone) is produced by the pituitary gland and controls how much hormone the thyroid gland releases. It is the single most sensitive marker for thyroid dysfunction. TSH rises when the thyroid is underactive and falls when it is overactive.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Hyperthyroidism (Graves' disease, toxic multinodular goitre)",
              "Excessive thyroid hormone replacement",
              "Subclinical hyperthyroidism",
              "Central hypothyroidism (pituitary or hypothalamic disease)",
              "Non-thyroidal illness (euthyroid sick syndrome)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Primary hypothyroidism (Hashimoto thyroiditis, iodine deficiency)",
              "Subclinical hypothyroidism",
              "Inadequate thyroid hormone replacement dose",
              "TSH-secreting pituitary adenoma (rare)",
              "Recovery phase of non-thyroidal illness",
              "Thyroid hormone resistance syndrome",
            ],
          },
        ],
        footerNote:
          "Pregnancy TSH reference ranges differ by trimester: 1st trimester 0.1–2.5 µIU/mL, 2nd trimester 0.2–3.0 µIU/mL, 3rd trimester 0.3–3.5 µIU/mL. Interpret accordingly in pregnant patients.",
      },
    ],
  },

  // ═══ TSH (PT0762) ══════════════════════════════════════════════════
  {
    testCode: "PT0762",
    reportTitle: "Thyroid Stimulating Hormone (TSH)",
    reportIntro:
      "TSH is the most sensitive first-line screening test for thyroid dysfunction. Produced by the pituitary gland, TSH regulates the thyroid gland's hormone production through a feedback mechanism. An abnormal TSH level is often the earliest indicator of thyroid disease, even before symptoms appear or other thyroid hormone levels become abnormal.",
    reportConclusion:
      "TSH is the single most useful test for detecting thyroid dysfunction. Abnormal results should be followed up with Free T4 and/or Free T3 measurements to confirm diagnosis. Medication timing, recent illness, and pregnancy status should be considered during interpretation.",
    parameters: [
      {
        name: "TSH",
        clinicalNote:
          "TSH (Thyroid Stimulating Hormone) is produced by the pituitary gland and controls how much hormone the thyroid gland releases. It is the single most sensitive marker for thyroid dysfunction. TSH rises when the thyroid is underactive and falls when it is overactive.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Hyperthyroidism (Graves' disease, toxic multinodular goitre)",
              "Excessive thyroid hormone replacement",
              "Subclinical hyperthyroidism",
              "Central hypothyroidism (pituitary or hypothalamic disease)",
              "Non-thyroidal illness (euthyroid sick syndrome)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Primary hypothyroidism (Hashimoto thyroiditis, iodine deficiency)",
              "Subclinical hypothyroidism",
              "Inadequate thyroid hormone replacement dose",
              "TSH-secreting pituitary adenoma (rare)",
              "Recovery phase of non-thyroidal illness",
              "Thyroid hormone resistance syndrome",
            ],
          },
        ],
        footerNote:
          "Pregnancy TSH reference ranges differ by trimester: 1st trimester 0.1–2.5 µIU/mL, 2nd trimester 0.2–3.0 µIU/mL, 3rd trimester 0.3–3.5 µIU/mL. Interpret accordingly in pregnant patients.",
      },
    ],
  },

  // ═══ LFT (PT_LFT) ═════════════════════════════════════════════════
  {
    testCode: "PT0556",
    reportTitle: "Liver Function Test (LFT)",
    reportIntro:
      "The Liver Function Test panel measures enzymes, proteins, and substances produced or processed by the liver. The liver is one of the largest and most vital organs, responsible for metabolism, detoxification, protein synthesis, and bile production. This panel helps detect liver damage, assess liver function, and monitor the progression of liver diseases. It is also used to evaluate the effects of medications that may affect the liver.",
    reportConclusion:
      "Liver function results should be interpreted as a pattern rather than in isolation. Elevated enzymes may indicate hepatocellular injury or cholestasis. Albumin and total protein reflect synthetic function. Clinical context including alcohol history, medication use, and imaging findings is essential for accurate diagnosis.",
    parameters: [
      {
        name: "Total Bilirubin",
        clinicalNote:
          "Bilirubin is a yellow pigment formed from the breakdown of red blood cells. The liver processes bilirubin so it can be excreted from the body. Elevated total bilirubin can cause jaundice (yellowing of skin and eyes) and may indicate liver disease, bile duct obstruction, or increased red blood cell destruction.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Generally not clinically significant",
              "May be seen with certain medications",
              "Low values are not typically a concern",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hepatitis (viral, alcoholic, autoimmune)",
              "Bile duct obstruction (gallstones, tumours)",
              "Haemolytic anaemia (increased red cell destruction)",
              "Gilbert syndrome (benign inherited condition)",
              "Cirrhosis",
              "Neonatal jaundice",
              "Drug-induced liver injury",
            ],
          },
        ],
      },
      {
        name: "Direct Bilirubin",
        clinicalNote:
          "Direct (conjugated) bilirubin has been processed by the liver and made water-soluble for excretion in bile. Elevated direct bilirubin specifically suggests a problem with bile flow from the liver, such as bile duct obstruction or intrahepatic cholestasis.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Not clinically significant",
              "Normal finding in healthy individuals",
              "Low values do not indicate pathology",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Bile duct obstruction (choledocholithiasis, pancreatic head tumour)",
              "Intrahepatic cholestasis",
              "Hepatitis with cholestatic component",
              "Drug-induced cholestasis",
              "Dubin-Johnson syndrome",
              "Primary biliary cholangitis",
            ],
          },
        ],
      },
      {
        name: "Indirect Bilirubin",
        clinicalNote:
          "Indirect (unconjugated) bilirubin has not yet been processed by the liver. It is transported bound to albumin and is elevated when there is excessive red blood cell breakdown or when the liver cannot adequately conjugate bilirubin.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Not clinically significant",
              "Normal finding",
              "No pathological implication",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Haemolytic anaemia (autoimmune, sickle cell, spherocytosis)",
              "Gilbert syndrome (most common benign cause)",
              "Crigler-Najjar syndrome",
              "Ineffective erythropoiesis (thalassaemia, megaloblastic anaemia)",
              "Large haematoma resorption",
              "Neonatal physiological jaundice",
            ],
          },
        ],
      },
      {
        name: "SGOT (AST)",
        clinicalNote:
          "AST (Aspartate Aminotransferase), also known as SGOT, is an enzyme found in the liver, heart, muscles, and other organs. When cells in these organs are damaged, AST is released into the blood. While elevated AST can indicate liver damage, it is less specific to the liver than ALT.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Vitamin B6 (pyridoxine) deficiency",
              "Uraemia (chronic kidney disease)",
              "Generally not clinically significant",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hepatitis (viral, alcoholic — AST:ALT ratio >2 suggests alcoholic liver disease)",
              "Cirrhosis",
              "Myocardial infarction",
              "Muscle injury or rhabdomyolysis",
              "Drug-induced hepatotoxicity (paracetamol overdose)",
              "Fatty liver disease (NAFLD/NASH)",
              "Congestive heart failure (hepatic congestion)",
            ],
          },
        ],
      },
      {
        name: "SGPT (ALT)",
        clinicalNote:
          "ALT (Alanine Aminotransferase), also known as SGPT, is an enzyme found predominantly in the liver. It is the most specific marker for liver cell damage. Elevated ALT levels typically indicate hepatocyte injury and are used to detect and monitor liver diseases.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Vitamin B6 deficiency",
              "Generally not clinically significant",
              "Chronic kidney disease",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Viral hepatitis (A, B, C, E)",
              "Non-alcoholic fatty liver disease (NAFLD/NASH)",
              "Drug-induced liver injury (statins, anti-TB drugs, paracetamol)",
              "Alcoholic liver disease",
              "Autoimmune hepatitis",
              "Ischaemic hepatitis (shock liver)",
              "Celiac disease",
            ],
          },
        ],
      },
      {
        name: "Alkaline Phosphatase",
        clinicalNote:
          "Alkaline Phosphatase (ALP) is an enzyme found in the liver, bile ducts, and bone. Elevated ALP is particularly useful for identifying bile duct obstruction or bone disorders. In liver disease, ALP rises primarily in cholestatic (bile flow obstruction) conditions.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Hypothyroidism",
              "Zinc or magnesium deficiency",
              "Pernicious anaemia",
              "Wilson disease",
              "Hypophosphatasia (rare genetic condition)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Bile duct obstruction (gallstones, tumours)",
              "Primary biliary cholangitis",
              "Drug-induced cholestasis",
              "Bone disorders (Paget disease, osteomalacia)",
              "Bone growth in children and adolescents (physiological)",
              "Pregnancy (placental ALP — third trimester)",
              "Metastatic bone disease",
            ],
          },
        ],
      },
      {
        name: "GGT",
        clinicalNote:
          "Gamma-Glutamyl Transferase (GGT) is an enzyme found mainly in the liver and bile ducts. It is a sensitive marker for liver and biliary disease and is particularly useful for detecting alcohol-related liver damage. GGT can help confirm whether an elevated ALP is of liver or bone origin.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Hypothyroidism",
              "Generally not clinically significant",
              "Low values are uncommon and benign",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Chronic alcohol use (very sensitive indicator)",
              "Bile duct obstruction",
              "Liver metastases",
              "Drug-induced hepatotoxicity (phenytoin, carbamazepine)",
              "Non-alcoholic fatty liver disease",
              "Pancreatitis",
              "Congestive heart failure",
            ],
          },
        ],
      },
      {
        name: "Total Protein",
        clinicalNote:
          "Total protein measures the combined amount of albumin and globulin in your blood. These proteins perform many important functions including transporting substances, fighting infections, and maintaining fluid balance. Changes in total protein can reflect liver function, nutritional status, or immune activity.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Malnutrition or malabsorption",
              "Liver disease (impaired synthesis)",
              "Nephrotic syndrome (protein loss in urine)",
              "Protein-losing enteropathy",
              "Overhydration",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Dehydration (haemoconcentration)",
              "Chronic infections (elevated immunoglobulins)",
              "Multiple myeloma (monoclonal protein)",
              "Chronic inflammatory conditions",
              "HIV/AIDS",
            ],
          },
        ],
      },
      {
        name: "Albumin",
        clinicalNote:
          "Albumin is the most abundant protein in the blood and is produced exclusively by the liver. It maintains fluid balance by keeping blood within vessels and transports hormones, vitamins, and drugs. Albumin levels are one of the best indicators of the liver's synthetic capacity and overall nutritional status.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Chronic liver disease or cirrhosis (impaired synthesis)",
              "Nephrotic syndrome (urinary protein loss)",
              "Malnutrition or malabsorption",
              "Chronic inflammation (negative acute phase reactant)",
              "Protein-losing enteropathy",
              "Burns (protein loss through damaged skin)",
              "Sepsis",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Dehydration (relative increase)",
              "High-protein diet (rare and usually mild)",
              "Prolonged tourniquet application during blood draw (artefact)",
            ],
          },
        ],
      },
      {
        name: "Globulin",
        clinicalNote:
          "Globulins are a group of proteins produced by the liver and immune system. They include immunoglobulins (antibodies), transport proteins, and clotting factors. Globulin levels help assess immune function and can indicate chronic infections, inflammatory conditions, or blood cancers.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Immunodeficiency disorders (hypogammaglobulinaemia)",
              "Nephrotic syndrome",
              "Malnutrition",
              "Hepatic failure",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Chronic infections (tuberculosis, hepatitis)",
              "Multiple myeloma or Waldenström macroglobulinaemia",
              "Autoimmune diseases (lupus, rheumatoid arthritis)",
              "Chronic liver disease (polyclonal gammopathy)",
              "Sarcoidosis",
            ],
          },
        ],
      },
      {
        name: "A/G Ratio",
        clinicalNote:
          "The Albumin/Globulin (A/G) ratio compares the two main protein groups in the blood. It provides a quick assessment of the balance between liver synthetic function (albumin) and immune/inflammatory activity (globulin). A reversal of this ratio can indicate significant underlying disease.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Chronic liver disease (decreased albumin production)",
              "Multiple myeloma (increased globulin)",
              "Chronic infections causing elevated immunoglobulins",
              "Autoimmune disorders",
              "Nephrotic syndrome (albumin loss)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Immunodeficiency states (decreased globulin)",
              "Genetic variations in immunoglobulin production",
              "Generally less clinically significant than low ratio",
            ],
          },
        ],
      },
    ],
  },

  // ═══ KFT (PT_KFT) ═════════════════════════════════════════════════
  {
    testCode: "PT0532",
    reportTitle: "Kidney Function Test (KFT / Renal Function Test)",
    reportIntro:
      "The Kidney Function Test panel evaluates how well your kidneys are filtering waste products from the blood, maintaining electrolyte balance, and regulating fluid homeostasis. The kidneys process approximately 180 litres of blood daily, filtering out waste while retaining essential substances. This panel is crucial for detecting acute or chronic kidney disease, monitoring patients on nephrotoxic medications, and managing electrolyte disorders.",
    reportConclusion:
      "Kidney function results should be interpreted alongside hydration status, muscle mass, dietary intake, and medication history. A single abnormal result may reflect transient changes; persistent abnormalities warrant further evaluation including imaging and urine studies. Serial monitoring is recommended for patients with known or suspected kidney disease.",
    parameters: [
      {
        name: "Blood Urea Nitrogen (BUN)",
        clinicalNote:
          "BUN measures the amount of nitrogen in the blood that comes from urea, a waste product of protein metabolism. The kidneys filter urea from the blood for excretion in urine. BUN levels rise when kidney function declines but can also be affected by diet, hydration, and liver function.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Severe liver disease (impaired urea synthesis)",
              "Malnutrition or low protein diet",
              "Overhydration",
              "Pregnancy (haemodilution)",
              "SIADH (syndrome of inappropriate ADH)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Acute or chronic kidney disease",
              "Dehydration or hypovolaemia",
              "High protein diet or gastrointestinal bleeding (protein load)",
              "Congestive heart failure (reduced renal perfusion)",
              "Urinary tract obstruction",
              "Catabolic states (burns, sepsis, corticosteroid use)",
            ],
          },
        ],
      },
      {
        name: "Urea",
        clinicalNote:
          "Urea is the primary waste product of protein metabolism, formed in the liver and excreted by the kidneys. Serum urea levels directly reflect the balance between urea production and kidney excretion. It serves as a marker for kidney function and protein metabolism status.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Liver failure (reduced urea synthesis)",
              "Low protein intake or malnutrition",
              "Overhydration",
              "Pregnancy",
              "Celiac disease or malabsorption",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Chronic kidney disease",
              "Acute kidney injury",
              "Dehydration",
              "Upper GI bleeding (absorbed blood protein)",
              "High protein diet",
              "Catabolic states",
              "Post-renal obstruction",
            ],
          },
        ],
      },
      {
        name: "Creatinine",
        clinicalNote:
          "Creatinine is a waste product generated from the normal breakdown of muscle creatine phosphate. It is produced at a relatively constant rate and filtered by the kidneys. Serum creatinine is one of the most reliable markers of kidney filtration function and is used to calculate eGFR.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Low muscle mass (elderly, debilitated patients)",
              "Severe liver disease",
              "Pregnancy (increased filtration)",
              "Inadequate protein intake",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Acute kidney injury",
              "Chronic kidney disease",
              "Dehydration",
              "Rhabdomyolysis (massive muscle breakdown)",
              "Nephrotoxic medications (NSAIDs, aminoglycosides, contrast dye)",
              "Urinary tract obstruction",
              "High muscle mass or high creatine intake (physiological)",
            ],
          },
        ],
      },
      {
        name: "Uric Acid",
        clinicalNote:
          "Uric acid is a waste product from the breakdown of purines, which are found in certain foods and produced by the body. The kidneys excrete most uric acid. Elevated levels can lead to gout (crystal deposition in joints) and kidney stones, and may be associated with cardiovascular risk.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "SIADH",
              "Wilson disease",
              "Fanconi syndrome (renal tubular defect)",
              "Low purine diet",
              "Allopurinol or uricosuric medications",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Gout",
              "Chronic kidney disease (reduced excretion)",
              "High purine diet (red meat, organ meats, shellfish)",
              "Tumour lysis syndrome (chemotherapy)",
              "Myeloproliferative and lymphoproliferative disorders",
              "Metabolic syndrome and obesity",
              "Diuretic use (thiazides)",
            ],
          },
        ],
      },
      {
        name: "eGFR (CKD-EPI)",
        clinicalNote:
          "The estimated Glomerular Filtration Rate (eGFR) is a calculated measure of how efficiently the kidneys filter blood. It is the best overall indicator of kidney function and is used to stage chronic kidney disease. It is calculated from serum creatinine, age, sex, and race.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Chronic kidney disease (staged by eGFR: Stage 3 = 30–59, Stage 4 = 15–29, Stage 5 = <15)",
              "Acute kidney injury",
              "Diabetic nephropathy",
              "Hypertensive nephrosclerosis",
              "Glomerulonephritis",
              "Polycystic kidney disease",
              "Urinary tract obstruction",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hyperfiltration (early diabetic nephropathy)",
              "Pregnancy (physiological increase)",
              "High cardiac output states",
            ],
          },
        ],
        footerNote:
          "CKD staging by eGFR: Stage 1 (≥90, with kidney damage), Stage 2 (60–89), Stage 3a (45–59), Stage 3b (30–44), Stage 4 (15–29), Stage 5 (<15, kidney failure). Values should be trended over time.",
      },
      {
        name: "Sodium",
        clinicalNote:
          "Sodium is the most abundant electrolyte in the blood and is essential for nerve and muscle function, fluid balance, and blood pressure regulation. The kidneys tightly regulate sodium levels. Abnormal sodium can cause serious neurological symptoms and requires careful evaluation.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "SIADH (syndrome of inappropriate ADH secretion)",
              "Diuretic use (especially thiazides)",
              "Heart failure (dilutional hyponatraemia)",
              "Liver cirrhosis with ascites",
              "Adrenal insufficiency (Addison disease)",
              "Excessive water intake (psychogenic polydipsia)",
              "Severe vomiting or diarrhoea",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Dehydration (inadequate water intake)",
              "Diabetes insipidus (central or nephrogenic)",
              "Excessive sodium intake (IV saline, dietary)",
              "Cushing syndrome (mineralocorticoid excess)",
              "Primary hyperaldosteronism (Conn syndrome)",
            ],
          },
        ],
      },
      {
        name: "Potassium",
        clinicalNote:
          "Potassium is a critical electrolyte for heart, muscle, and nerve function. Even small deviations from normal can cause life-threatening cardiac arrhythmias. The kidneys are the primary regulators of potassium balance, and potassium levels are closely monitored in patients with kidney disease or on certain medications.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Diuretic use (furosemide, thiazides)",
              "Severe vomiting or diarrhoea",
              "Renal tubular acidosis",
              "Hyperaldosteronism",
              "Insulin administration (shifts potassium intracellularly)",
              "Magnesium deficiency",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Acute or chronic kidney disease (reduced excretion)",
              "ACE inhibitors, ARBs, or potassium-sparing diuretics",
              "Addison disease (mineralocorticoid deficiency)",
              "Metabolic acidosis (potassium shifts out of cells)",
              "Rhabdomyolysis or tumour lysis syndrome (cell breakdown)",
              "Haemolysed sample (artefact — repeat recommended)",
            ],
          },
        ],
      },
      {
        name: "Chloride",
        clinicalNote:
          "Chloride is a negatively charged electrolyte that works closely with sodium to maintain fluid balance, blood volume, and acid-base equilibrium. Chloride levels typically mirror sodium trends. It is an important component in calculating the anion gap for diagnosing metabolic acidosis.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Prolonged vomiting (loss of HCl from stomach)",
              "Metabolic alkalosis",
              "SIADH",
              "Diuretic therapy",
              "Addison disease",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Dehydration",
              "Renal tubular acidosis",
              "Excessive saline infusion",
              "Metabolic acidosis (non-anion gap / hyperchloraemic)",
              "Diabetes insipidus",
              "Respiratory alkalosis (compensatory)",
            ],
          },
        ],
      },
      {
        name: "Bicarbonate (HCO3-)",
        clinicalNote:
          "Bicarbonate is a key buffer in the blood that helps maintain proper acid-base balance (pH). The kidneys regulate bicarbonate by reabsorbing or excreting it as needed. Abnormal bicarbonate levels indicate acid-base disturbances and can guide diagnosis of metabolic acidosis or alkalosis.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Metabolic acidosis (diabetic ketoacidosis, lactic acidosis)",
              "Chronic kidney disease (impaired acid excretion)",
              "Diarrhoea (bicarbonate loss)",
              "Renal tubular acidosis",
              "Salicylate or methanol poisoning",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Metabolic alkalosis (prolonged vomiting, nasogastric suction)",
              "Diuretic therapy",
              "Cushing syndrome or corticosteroid use",
              "Chronic respiratory acidosis (renal compensation — COPD)",
              "Excessive alkali intake (antacid overuse)",
            ],
          },
        ],
      },
      {
        name: "BUN/Creatinine Ratio",
        clinicalNote:
          "The BUN/Creatinine ratio helps differentiate causes of elevated BUN or creatinine. A high ratio suggests pre-renal causes such as dehydration or upper GI bleeding, while a low ratio may indicate liver disease or malnutrition.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Liver disease (reduced urea production)",
              "Malnutrition or low protein diet",
              "Rhabdomyolysis (elevated creatinine)",
              "SIADH (dilutional effect)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Dehydration or hypovolaemia",
              "Upper gastrointestinal bleeding",
              "High protein diet or catabolic states",
              "Congestive heart failure",
              "Urinary tract obstruction",
            ],
          },
        ],
      },
    ],
  },

  // ═══ Lipid Profile (PT_LIPID) ═══════════════════════════════════════
  {
    testCode: "PT0553",
    reportTitle: "Lipid Profile (Fasting Lipid Panel)",
    reportIntro:
      "The Lipid Profile measures fats and fatty substances in the blood that are essential for cell function but can be harmful in excess. Abnormal lipid levels are a major risk factor for atherosclerosis, coronary artery disease, stroke, and peripheral vascular disease. This panel is a cornerstone of cardiovascular risk assessment and is used to guide lifestyle modifications and lipid-lowering therapy.",
    reportConclusion:
      "Lipid values should be interpreted in the context of overall cardiovascular risk, including age, sex, blood pressure, diabetes status, smoking history, and family history of premature cardiovascular disease. Fasting status at the time of collection should be confirmed. Non-fasting samples may affect triglyceride and LDL calculations.",
    parameters: [
      {
        name: "Total Cholesterol",
        clinicalNote:
          "Total cholesterol measures the overall amount of cholesterol in your blood, including both 'good' (HDL) and 'bad' (LDL) cholesterol. Cholesterol is essential for building cell membranes and producing hormones, but excess levels contribute to plaque buildup in arteries.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Malnutrition or malabsorption",
              "Hyperthyroidism (increased clearance)",
              "Liver disease (impaired synthesis)",
              "Chronic infections or sepsis",
              "Abetalipoproteinaemia (rare genetic condition)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Familial hypercholesterolaemia",
              "High saturated fat diet",
              "Hypothyroidism",
              "Nephrotic syndrome",
              "Obstructive liver disease (cholestasis)",
              "Obesity and metabolic syndrome",
              "Diabetes mellitus (uncontrolled)",
            ],
          },
        ],
      },
      {
        name: "Triglycerides",
        clinicalNote:
          "Triglycerides are the most common type of fat in the body. They store excess energy from your diet and release it between meals. Elevated triglycerides are an independent risk factor for cardiovascular disease and very high levels can cause pancreatitis.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Malnutrition or malabsorption",
              "Hyperthyroidism",
              "Low fat diet",
              "Abetalipoproteinaemia",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Obesity and metabolic syndrome",
              "Uncontrolled diabetes mellitus (especially type 2)",
              "Excessive alcohol consumption",
              "Hypothyroidism",
              "Nephrotic syndrome",
              "Medications (corticosteroids, oral oestrogens, retinoids)",
              "Familial hypertriglyceridaemia",
            ],
          },
        ],
        footerNote:
          "Triglyceride levels >500 mg/dL significantly increase the risk of acute pancreatitis. Very high levels warrant urgent intervention.",
      },
      {
        name: "HDL Cholesterol",
        clinicalNote:
          "HDL (High-Density Lipoprotein) cholesterol is often called 'good' cholesterol because it helps remove excess cholesterol from arteries and transport it back to the liver for disposal. Higher HDL levels are associated with lower cardiovascular risk.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Sedentary lifestyle",
              "Smoking",
              "Obesity and metabolic syndrome",
              "Type 2 diabetes mellitus",
              "High triglyceride levels (inverse relationship)",
              "Medications (beta-blockers, anabolic steroids)",
              "Genetic factors (familial hypoalphalipoproteinaemia)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Regular aerobic exercise",
              "Moderate alcohol consumption",
              "Genetic factors",
              "Oestrogen therapy",
              "Primary biliary cholangitis (very high HDL)",
            ],
          },
        ],
      },
      {
        name: "LDL Cholesterol",
        clinicalNote:
          "LDL (Low-Density Lipoprotein) cholesterol is often called 'bad' cholesterol because excess LDL deposits cholesterol in artery walls, forming plaques that narrow and stiffen arteries. LDL is the primary target for cholesterol-lowering therapy and cardiovascular risk reduction.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Hyperthyroidism",
              "Malnutrition",
              "Chronic liver disease",
              "Statin therapy (desired effect)",
              "Abetalipoproteinaemia",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Familial hypercholesterolaemia",
              "Diet high in saturated and trans fats",
              "Hypothyroidism",
              "Nephrotic syndrome",
              "Diabetes mellitus",
              "Obesity",
              "Obstructive liver disease",
            ],
          },
        ],
        footerNote:
          "LDL targets depend on cardiovascular risk: <100 mg/dL for high-risk patients, <70 mg/dL for very high-risk patients (established CVD, diabetes with organ damage).",
      },
      {
        name: "VLDL Cholesterol",
        clinicalNote:
          "VLDL (Very Low-Density Lipoprotein) is produced by the liver and carries triglycerides to tissues. It is a precursor to LDL cholesterol. Elevated VLDL contributes to plaque buildup in arteries and is closely linked to triglyceride levels.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Abetalipoproteinaemia",
              "Malnutrition",
              "Hyperthyroidism",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Obesity and metabolic syndrome",
              "Uncontrolled diabetes mellitus",
              "Excessive alcohol intake",
              "High carbohydrate diet",
              "Nephrotic syndrome",
              "Familial combined hyperlipidaemia",
            ],
          },
        ],
      },
      {
        name: "Non-HDL Cholesterol",
        clinicalNote:
          "Non-HDL cholesterol is calculated by subtracting HDL from total cholesterol. It represents all the 'bad' cholesterol-carrying particles (LDL, VLDL, IDL, lipoprotein(a)) combined. It may be a better predictor of cardiovascular risk than LDL alone, especially when triglycerides are elevated.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Malnutrition",
              "Hyperthyroidism",
              "Chronic liver disease",
              "Very low fat diet",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Familial hyperlipidaemia",
              "Uncontrolled diabetes",
              "Hypothyroidism",
              "Nephrotic syndrome",
              "Obesity and sedentary lifestyle",
              "High saturated fat diet",
            ],
          },
        ],
      },
      {
        name: "Total Cholesterol/HDL Ratio",
        clinicalNote:
          "The Total Cholesterol to HDL ratio is a simple but powerful indicator of cardiovascular risk. A lower ratio indicates a more favourable balance between total and protective cholesterol. It is considered by many cardiologists to be a better risk predictor than individual lipid values alone.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Very high HDL (generally cardioprotective)",
              "Low total cholesterol",
              "Indicates lower cardiovascular risk",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Low HDL combined with high total cholesterol",
              "Metabolic syndrome",
              "Uncontrolled diabetes",
              "Sedentary lifestyle with poor diet",
              "Smoking (lowers HDL)",
              "Indicates elevated cardiovascular risk",
            ],
          },
        ],
        footerNote:
          "Desirable TC/HDL ratio: <3.5 (optimal), 3.5–5.0 (moderate risk), >5.0 (high cardiovascular risk). This ratio provides a quick cardiovascular risk snapshot.",
      },
      {
        name: "LDL/HDL Ratio",
        clinicalNote:
          "The LDL/HDL ratio compares the amount of harmful LDL cholesterol to protective HDL cholesterol. A lower ratio indicates better cardiovascular health. This ratio is increasingly used alongside TC/HDL ratio for refined risk stratification.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "High HDL levels (exercise, moderate alcohol, genetics)",
              "Low LDL (effective statin therapy)",
              "Indicates lower cardiovascular risk",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "High LDL with low HDL",
              "Familial hypercholesterolaemia",
              "Sedentary lifestyle with high saturated fat diet",
              "Metabolic syndrome",
              "Indicates elevated cardiovascular risk",
            ],
          },
        ],
      },
    ],
  },

  // ═══ Diabetes (PT_DIAB) ═════════════════════════════════════════════
  {
    testCode: "PT_DIAB",
    reportTitle: "Diabetes Panel (Glycaemic Assessment)",
    reportIntro:
      "The Diabetes Panel provides a comprehensive assessment of blood sugar regulation and insulin function. Diabetes mellitus is a metabolic disorder characterised by chronic hyperglycaemia resulting from defects in insulin secretion, insulin action, or both. This panel includes fasting and post-meal glucose measurements, long-term glycaemic control (HbA1c), and insulin levels to help diagnose diabetes, prediabetes, and insulin resistance.",
    reportConclusion:
      "Diabetes diagnosis requires confirmation with repeat testing on a separate day unless unequivocal hyperglycaemia is present. Results should be interpreted with awareness of haemoglobin variants, recent blood loss, or conditions that affect red blood cell turnover, which may impact HbA1c accuracy.",
    parameters: [
      {
        name: "Fasting Blood Glucose",
        clinicalNote:
          "Fasting blood glucose measures the sugar level in your blood after not eating for at least 8–12 hours. It reflects baseline glucose production by the liver and the body's ability to regulate blood sugar. It is one of the primary tests for screening and diagnosing diabetes.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Insulin overdose or excess oral hypoglycaemics",
              "Insulinoma (insulin-producing tumour)",
              "Adrenal insufficiency",
              "Severe liver disease (impaired gluconeogenesis)",
              "Alcohol intake (inhibits gluconeogenesis)",
              "Prolonged fasting or malnutrition",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Diabetes mellitus (type 1 or type 2)",
              "Prediabetes / impaired fasting glucose (100–125 mg/dL)",
              "Cushing syndrome (excess cortisol)",
              "Acromegaly (excess growth hormone)",
              "Stress hyperglycaemia (acute illness, surgery)",
              "Medications (corticosteroids, thiazide diuretics)",
              "Pancreatic disease (pancreatitis, pancreatic cancer)",
            ],
          },
        ],
        footerNote:
          "Diagnostic criteria: Normal <100 mg/dL, Prediabetes (IFG) 100–125 mg/dL, Diabetes ≥126 mg/dL (requires confirmation on a separate day).",
      },
      {
        name: "Post-Prandial Glucose (PP)",
        clinicalNote:
          "Post-prandial glucose measures blood sugar 2 hours after a meal. It reflects how effectively your body handles a glucose load, particularly insulin's ability to lower blood sugar after eating. Elevated post-meal glucose is often one of the earliest signs of impaired glucose metabolism.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Reactive hypoglycaemia (post-gastric surgery)",
              "Excessive insulin or oral hypoglycaemic agents",
              "Insulinoma",
              "Adrenal insufficiency",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Diabetes mellitus",
              "Impaired glucose tolerance (140–199 mg/dL)",
              "Gestational diabetes",
              "Cushing syndrome",
              "Medications (corticosteroids, antipsychotics)",
              "Stress response (catecholamine-mediated)",
              "Acromegaly",
            ],
          },
        ],
        footerNote:
          "Diagnostic criteria (2-hour post-meal): Normal <140 mg/dL, Impaired Glucose Tolerance (IGT) 140–199 mg/dL, Diabetes ≥200 mg/dL.",
      },
      {
        name: "HbA1c",
        clinicalNote:
          "HbA1c (glycated haemoglobin) measures the average blood sugar level over the preceding 2–3 months. Glucose binds to haemoglobin in red blood cells, and the more glucose in the blood, the more haemoglobin becomes glycated. It is the gold standard for monitoring long-term diabetes control.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Haemolytic anaemia (shortened red cell lifespan)",
              "Recent significant blood loss",
              "Chronic kidney disease (with erythropoietin use)",
              "Blood transfusions (dilution effect)",
              "Haemoglobin variants (HbS, HbC — methodological interference)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Uncontrolled or poorly controlled diabetes mellitus",
              "Newly diagnosed diabetes",
              "Non-adherence to diabetes medications",
              "Iron deficiency anaemia (prolonged red cell life falsely elevates)",
              "Splenectomy (prolonged red cell survival)",
              "Chronic alcohol use",
            ],
          },
        ],
        footerNote:
          "HbA1c interpretation: Normal <5.7%, Prediabetes 5.7–6.4%, Diabetes ≥6.5%. For diagnosed diabetics, target is generally <7.0% (individualised). HbA1c may be unreliable in conditions affecting red blood cell turnover.",
      },
      {
        name: "Insulin (Fasting)",
        clinicalNote:
          "Fasting insulin measures the amount of insulin your pancreas produces when you have not eaten. It helps evaluate insulin resistance, where the body requires more insulin than normal to control blood sugar. High fasting insulin often precedes the development of type 2 diabetes.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Type 1 diabetes (autoimmune destruction of beta cells)",
              "Late-stage type 2 diabetes (beta cell exhaustion)",
              "Chronic pancreatitis with beta cell loss",
              "Pancreatectomy",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Insulin resistance (metabolic syndrome, PCOS)",
              "Early type 2 diabetes (compensatory hyperinsulinaemia)",
              "Insulinoma (insulin-secreting tumour)",
              "Obesity",
              "Cushing syndrome",
              "Acromegaly",
              "Medications (corticosteroids, oral contraceptives)",
            ],
          },
        ],
      },
    ],
  },

  // ═══ Urine Routine (PT0244) ════════════════════════════════════════
  {
    testCode: "PT0244",
    reportTitle: "Urine Routine and Microscopy",
    reportIntro:
      "Urine Routine and Microscopy is a comprehensive evaluation of urine that includes physical examination (colour, appearance), chemical analysis (dipstick testing for pH, protein, glucose, blood, and other substances), and microscopic examination of sediment. Urine analysis provides valuable information about kidney function, urinary tract infections, metabolic diseases, and systemic conditions. It is one of the most frequently performed laboratory tests.",
    reportConclusion:
      "Urine findings should be correlated with clinical symptoms and other laboratory data. A single abnormal urinalysis may reflect transient changes; persistent abnormalities warrant repeat testing and further evaluation. Proper collection technique (midstream clean catch) is essential for accurate results, especially for microscopy and culture.",
    parameters: [
      {
        name: "Colour",
        clinicalNote:
          "Urine colour can range from pale yellow to deep amber, depending on hydration status and concentration. Abnormal colours such as red, brown, orange, or green may indicate the presence of blood, bilirubin, medications, or certain foods.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Dark yellow/amber: Concentrated urine due to dehydration",
              "Red/pink: Haematuria, haemoglobinuria, beetroot consumption, rifampicin",
              "Brown/cola-coloured: Myoglobinuria, bile pigments, severe dehydration",
              "Orange: Bilirubin, phenazopyridine, excessive carrots",
              "Green: Pseudomonas infection, methylene blue, amitriptyline",
            ],
          },
        ],
      },
      {
        name: "Appearance",
        clinicalNote:
          "Normal urine is clear. Cloudy or turbid urine may indicate the presence of white blood cells, bacteria, crystals, mucus, or lipids. The appearance provides an initial clue about possible infection or other urinary abnormalities.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Hazy/turbid: Urinary tract infection (WBCs, bacteria)",
              "Cloudy: Phosphate crystals in alkaline urine, pyuria",
              "Milky: Chyluria (lymphatic fistula), severe pyuria",
              "Foamy: Proteinuria (nephrotic syndrome)",
            ],
          },
        ],
      },
      {
        name: "pH",
        clinicalNote:
          "Urine pH reflects the acid-base balance maintained by the kidneys. Normal urine is slightly acidic. The pH can be influenced by diet, medications, metabolic conditions, and urinary tract infections. It is important in assessing risk for kidney stone formation.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "High protein diet (acid-producing)",
              "Metabolic acidosis (diabetic ketoacidosis)",
              "Respiratory acidosis (COPD)",
              "Cranberry juice consumption",
              "Uric acid or cystine stone risk",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Urinary tract infection with urease-producing bacteria (Proteus)",
              "Vegetarian diet (alkaline-producing)",
              "Metabolic alkalosis (vomiting)",
              "Renal tubular acidosis",
              "Calcium phosphate stone risk",
            ],
          },
        ],
      },
      {
        name: "Specific Gravity",
        clinicalNote:
          "Specific gravity measures the concentration of dissolved substances in urine, reflecting the kidney's ability to concentrate or dilute urine. It provides a quick assessment of hydration status and renal concentrating ability.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Excessive fluid intake (water intoxication)",
              "Diabetes insipidus (inability to concentrate urine)",
              "Chronic kidney disease (loss of concentrating ability)",
              "Diuretic use",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Dehydration (concentrated urine)",
              "Diabetes mellitus (glycosuria increases density)",
              "Congestive heart failure (reduced renal perfusion)",
              "SIADH (concentrated but dilute-appearing urine)",
              "IV contrast dye (artefact)",
            ],
          },
        ],
      },
      {
        name: "Protein",
        clinicalNote:
          "Protein in the urine (proteinuria) is an important marker for kidney damage. Healthy kidneys filter out almost all protein and return it to the blood. The presence of protein in urine can indicate glomerular damage, tubular dysfunction, or overflow from excessive blood protein production.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Glomerulonephritis",
              "Diabetic nephropathy",
              "Nephrotic syndrome",
              "Hypertensive nephrosclerosis",
              "Urinary tract infection",
              "Orthostatic proteinuria (benign, in young adults)",
              "Vigorous exercise (transient)",
              "Multiple myeloma (Bence Jones protein)",
            ],
          },
        ],
      },
      {
        name: "Glucose",
        clinicalNote:
          "Glucose is not normally present in urine. It appears when blood glucose levels exceed the kidney's reabsorption threshold (approximately 180 mg/dL). The presence of glucose in urine (glycosuria) is commonly associated with diabetes mellitus but can also indicate renal tubular disorders.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Diabetes mellitus (most common cause)",
              "Gestational diabetes",
              "Renal glycosuria (low renal threshold — benign)",
              "Fanconi syndrome",
              "Cushing syndrome",
              "SGLT2 inhibitor therapy (pharmacological glycosuria — expected)",
            ],
          },
        ],
      },
      {
        name: "Ketones",
        clinicalNote:
          "Ketones are produced when the body breaks down fat for energy instead of glucose. Their presence in urine (ketonuria) indicates that the body is in a state of fat metabolism, which can occur in uncontrolled diabetes, fasting, or low-carbohydrate diets.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Diabetic ketoacidosis (DKA — medical emergency)",
              "Starvation or prolonged fasting",
              "Very low carbohydrate / ketogenic diet",
              "Alcoholic ketoacidosis",
              "Severe vomiting (prolonged emesis)",
              "Intense prolonged exercise",
            ],
          },
        ],
      },
      {
        name: "Bilirubin",
        clinicalNote:
          "Bilirubin in urine is always abnormal and indicates the presence of conjugated (direct) bilirubin that has been excreted by the kidneys. It is an early indicator of liver disease or bile duct obstruction, often appearing before clinical jaundice becomes visible.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Obstructive jaundice (gallstones, pancreatic head tumour)",
              "Hepatitis (viral, drug-induced)",
              "Cirrhosis",
              "Intrahepatic cholestasis",
              "Drug-induced cholestasis",
            ],
          },
        ],
      },
      {
        name: "Urobilinogen",
        clinicalNote:
          "Urobilinogen is produced in the intestines from bilirubin by bacterial action and is partially reabsorbed. Small amounts in urine are normal. Abnormal levels can help differentiate between haemolytic conditions, liver disease, and biliary obstruction.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Complete bile duct obstruction (no bilirubin reaching intestine)",
              "Broad-spectrum antibiotic use (reduced intestinal bacteria)",
              "Severe cholestasis",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Haemolytic anaemia (increased bilirubin production)",
              "Hepatitis (impaired hepatic uptake)",
              "Cirrhosis",
              "Congestive heart failure with hepatic congestion",
            ],
          },
        ],
      },
      {
        name: "Blood",
        clinicalNote:
          "Blood detected on urine dipstick may indicate intact red blood cells (haematuria), free haemoglobin (haemoglobinuria), or myoglobin (myoglobinuria). Even trace amounts of blood in urine warrant further investigation to rule out serious conditions.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Urinary tract infection",
              "Kidney stones (nephrolithiasis)",
              "Glomerulonephritis",
              "Bladder or renal cell carcinoma",
              "Benign prostatic hyperplasia",
              "Vigorous exercise (runner's haematuria)",
              "Menstrual contamination (in females — repeat collection advised)",
            ],
          },
        ],
      },
      {
        name: "Leucocytes",
        clinicalNote:
          "The leucocyte esterase test detects an enzyme released by white blood cells. A positive result indicates the presence of white blood cells in the urine, which is a hallmark of urinary tract inflammation or infection.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Urinary tract infection (most common cause)",
              "Interstitial nephritis",
              "Kidney stones causing irritation",
              "Sexually transmitted infections",
              "Contamination from vaginal secretions",
            ],
          },
        ],
      },
      {
        name: "Nitrites",
        clinicalNote:
          "Nitrites in urine indicate the presence of bacteria that convert dietary nitrates to nitrites. A positive nitrite test is highly suggestive of a bacterial urinary tract infection, particularly with gram-negative organisms such as E. coli.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Bacterial urinary tract infection (gram-negative organisms, especially E. coli)",
              "Asymptomatic bacteriuria",
              "Specimen contamination or prolonged standing of sample",
            ],
          },
        ],
        footerNote:
          "A negative nitrite test does not exclude UTI; some bacteria (Enterococcus, Staphylococcus, Pseudomonas) do not produce nitrites. Clinical correlation and urine culture are recommended when infection is suspected.",
      },
      {
        name: "Pus Cells (HPF)",
        clinicalNote:
          "Pus cells (white blood cells) seen under the microscope indicate inflammation or infection in the urinary tract. Normal urine may contain up to 5 pus cells per high-power field. Higher counts strongly suggest urinary tract infection or other inflammatory conditions.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Urinary tract infection",
              "Pyelonephritis (kidney infection)",
              "Interstitial nephritis",
              "Prostatitis",
              "Sexually transmitted infections",
              "Renal tuberculosis",
            ],
          },
        ],
      },
      {
        name: "RBCs (HPF)",
        clinicalNote:
          "Red blood cells seen under the microscope confirm haematuria detected on dipstick testing. Their morphology (dysmorphic vs isomorphic) can help distinguish between glomerular and non-glomerular sources of bleeding.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Kidney stones",
              "Glomerulonephritis (dysmorphic RBCs, RBC casts)",
              "Urinary tract infection",
              "Bladder or renal malignancy",
              "Trauma",
              "IgA nephropathy",
              "Coagulation disorders",
            ],
          },
        ],
      },
      {
        name: "Epithelial Cells",
        clinicalNote:
          "Epithelial cells in urine originate from the lining of the urinary tract. Small numbers of squamous epithelial cells are normal, especially in female specimens. Large numbers may indicate contamination during collection. Renal tubular epithelial cells are always significant.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Squamous: Contamination from skin or vaginal secretions (most common)",
              "Transitional: Urinary tract infection or catheterisation",
              "Renal tubular: Acute tubular necrosis, nephrotoxic drug injury, viral infection",
            ],
          },
        ],
      },
      {
        name: "Casts",
        clinicalNote:
          "Urinary casts are cylindrical structures formed in the kidney tubules. Their composition provides important diagnostic information. Hyaline casts may be normal in small numbers, but granular, cellular, or waxy casts indicate significant kidney pathology.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Hyaline casts: Exercise, dehydration, diuretic use (may be normal)",
              "Granular casts: Chronic kidney disease, acute tubular necrosis",
              "RBC casts: Glomerulonephritis (diagnostic)",
              "WBC casts: Pyelonephritis, interstitial nephritis",
              "Waxy casts: Chronic kidney disease (advanced)",
              "Fatty casts: Nephrotic syndrome",
            ],
          },
        ],
      },
      {
        name: "Crystals",
        clinicalNote:
          "Crystals form in urine when certain substances become supersaturated. Their type depends on urine pH and composition. Some crystals are normal findings, while others may indicate metabolic disorders or increased risk of kidney stone formation.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Calcium oxalate: Most common stone type, ethylene glycol poisoning",
              "Uric acid: Gout, tumour lysis syndrome, acidic urine",
              "Triple phosphate (struvite): UTI with urease-producing bacteria",
              "Cystine: Cystinuria (genetic aminoaciduria)",
              "Calcium phosphate: Alkaline urine, hyperparathyroidism",
            ],
          },
        ],
      },
      {
        name: "Bacteria",
        clinicalNote:
          "Bacteria in the urine sediment may indicate urinary tract infection. However, their significance depends on the collection method and whether the patient has symptoms. Contamination during collection is a common cause of bacteria in urine.",
        abnormalityNote: [
          {
            direction: "HIGH",
            reasons: [
              "Urinary tract infection",
              "Asymptomatic bacteriuria (common in elderly, catheterised patients)",
              "Contamination during specimen collection",
              "Delayed processing of specimen (bacterial multiplication)",
            ],
          },
        ],
      },
    ],
  },

  // ═══ Coagulation (PT_COAG) ══════════════════════════════════════════
  {
    testCode: "PT_COAG",
    reportTitle: "Coagulation Profile",
    reportIntro:
      "The Coagulation Profile evaluates the blood's ability to form clots and break them down. Normal haemostasis requires a delicate balance between pro-coagulant and anticoagulant factors. This panel assesses both the extrinsic (PT/INR) and intrinsic (APTT) coagulation pathways, fibrinogen as a clot-forming substrate, and D-dimer as a marker of fibrin breakdown. It is essential for evaluating bleeding disorders, monitoring anticoagulant therapy, and assessing thrombotic risk.",
    reportConclusion:
      "Coagulation results should be interpreted in the clinical context of bleeding symptoms, thrombotic history, liver function, and current medications. Anticoagulant therapy must be documented for accurate interpretation. Mixing studies may be required to differentiate between factor deficiency and inhibitor presence.",
    parameters: [
      {
        name: "PT (Prothrombin Time)",
        clinicalNote:
          "Prothrombin Time measures how long it takes blood to clot via the extrinsic and common pathways. It evaluates factors VII, X, V, prothrombin, and fibrinogen. PT is the primary test for monitoring warfarin therapy and detecting liver-related coagulopathy.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Generally not clinically significant",
              "Vitamin K supplementation",
              "Thrombotic tendency (rare)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Warfarin therapy (expected therapeutic effect)",
              "Vitamin K deficiency (malabsorption, antibiotics)",
              "Liver disease (impaired factor synthesis)",
              "Disseminated intravascular coagulation (DIC)",
              "Factor VII deficiency (congenital or acquired)",
              "Massive blood transfusion (dilutional coagulopathy)",
            ],
          },
        ],
      },
      {
        name: "INR",
        clinicalNote:
          "INR (International Normalised Ratio) is a standardised way of reporting prothrombin time, making results comparable across different laboratories and reagents. It is the standard measure for monitoring warfarin anticoagulation therapy and assessing bleeding risk.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Subtherapeutic warfarin dose",
              "Increased vitamin K intake",
              "Drug interactions reducing warfarin effect",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Supratherapeutic warfarin dosing",
              "Vitamin K deficiency",
              "Liver disease or failure",
              "DIC",
              "Drug interactions potentiating warfarin (amiodarone, fluconazole)",
              "Factor deficiency (VII, X, V, II)",
            ],
          },
        ],
        footerNote:
          "Therapeutic INR ranges: 2.0–3.0 for most indications (atrial fibrillation, DVT/PE), 2.5–3.5 for mechanical heart valves. Values >4.5 significantly increase bleeding risk.",
      },
      {
        name: "APTT",
        clinicalNote:
          "Activated Partial Thromboplastin Time evaluates the intrinsic and common coagulation pathways (factors XII, XI, IX, VIII, X, V, prothrombin, fibrinogen). APTT is used to monitor heparin therapy and screen for intrinsic pathway factor deficiencies including haemophilia.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Acute phase response (elevated factor VIII)",
              "Active thrombosis or hypercoagulable state",
              "Disseminated intravascular coagulation (early phase)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Heparin therapy (expected therapeutic effect)",
              "Haemophilia A (factor VIII deficiency)",
              "Haemophilia B (factor IX deficiency)",
              "Von Willebrand disease",
              "Lupus anticoagulant (paradoxically associated with thrombosis)",
              "Liver disease",
              "DIC (consumption of factors)",
            ],
          },
        ],
      },
      {
        name: "Fibrinogen",
        clinicalNote:
          "Fibrinogen is a protein produced by the liver that is converted to fibrin during clot formation. It is both a coagulation factor and an acute phase reactant. Fibrinogen levels are critical in assessing both bleeding risk (low levels) and thrombotic/inflammatory risk (high levels).",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Disseminated intravascular coagulation (DIC — consumption)",
              "Severe liver disease (impaired synthesis)",
              "Primary fibrinolysis",
              "Massive blood transfusion (dilution)",
              "Congenital afibrinogenaemia or hypofibrinogenaemia (rare)",
              "L-asparaginase therapy",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Acute infection or inflammation (acute phase response)",
              "Pregnancy (physiological increase)",
              "Post-operative state",
              "Malignancy",
              "Coronary artery disease (cardiovascular risk factor)",
              "Nephrotic syndrome",
            ],
          },
        ],
      },
      {
        name: "D-Dimer",
        clinicalNote:
          "D-dimer is a fibrin degradation product released when blood clots are broken down. It is a highly sensitive marker for thrombotic activity. A negative D-dimer is very useful for ruling out deep vein thrombosis (DVT) and pulmonary embolism (PE) in low-risk patients.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Normal finding indicating no active clot breakdown",
              "High negative predictive value for VTE",
              "Low values are reassuring in appropriate clinical context",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Deep vein thrombosis (DVT)",
              "Pulmonary embolism (PE)",
              "Disseminated intravascular coagulation (DIC)",
              "Recent surgery or trauma",
              "Malignancy",
              "Pregnancy (physiological elevation)",
              "Acute infection or sepsis",
              "Aortic dissection",
            ],
          },
        ],
        footerNote:
          "D-dimer is highly sensitive but non-specific. Age-adjusted cutoff (age × 10 ng/mL for patients >50 years) improves specificity. Elevated D-dimer does not confirm thrombosis — imaging (CT pulmonary angiography or Doppler ultrasound) is required for definitive diagnosis.",
      },
    ],
  },

  // ═══ Cardiac Markers (PT_CARDIAC) ═══════════════════════════════════
  {
    testCode: "PT_CARDIAC",
    reportTitle: "Cardiac Biomarker Panel",
    reportIntro:
      "The Cardiac Biomarker Panel measures proteins released into the blood when the heart muscle is damaged or stressed. These markers are essential for diagnosing acute myocardial infarction (heart attack), assessing the severity of heart failure, and monitoring patients with known cardiac disease. Troponin is the most specific marker for myocardial injury, while BNP/NT-proBNP reflects cardiac wall stress and volume overload.",
    reportConclusion:
      "Cardiac biomarkers must always be interpreted alongside clinical presentation (chest pain, dyspnoea), ECG findings, and imaging results. Serial measurements over 3–6 hours are essential for diagnosing acute myocardial infarction, as a single value may miss early or evolving events. Non-cardiac causes of troponin elevation should be considered.",
    parameters: [
      {
        name: "Troponin I",
        clinicalNote:
          "Troponin I is a protein found exclusively in heart muscle cells. When the heart is damaged, troponin is released into the bloodstream. It is the most sensitive and specific biomarker for detecting myocardial injury and is the gold standard for diagnosing acute myocardial infarction.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Normal finding — indicates no detectable myocardial injury",
              "Very low levels are expected in healthy individuals",
              "High sensitivity assays may detect very low normal values",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Acute myocardial infarction (type 1 MI — plaque rupture)",
              "Myocardial injury without infarction (type 2 MI — supply-demand mismatch)",
              "Myocarditis (viral, autoimmune)",
              "Pulmonary embolism (right ventricular strain)",
              "Heart failure (acute decompensation)",
              "Sepsis with myocardial depression",
              "Renal failure (reduced clearance, chronic low-grade elevation)",
            ],
          },
        ],
      },
      {
        name: "CK-MB",
        clinicalNote:
          "CK-MB (Creatine Kinase-MB isoenzyme) is found primarily in heart muscle. It rises within 4–6 hours of myocardial injury and returns to normal within 48–72 hours. Although less specific than troponin, it is useful for detecting reinfarction and timing the onset of myocardial damage.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Normal finding",
              "Low muscle mass",
              "Not clinically significant",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Acute myocardial infarction",
              "Cardiac surgery (post-CABG, valve replacement)",
              "Myocarditis",
              "Severe skeletal muscle injury (rhabdomyolysis — check CK-MB/CK ratio)",
              "Muscular dystrophy",
              "Cardioversion or defibrillation",
            ],
          },
        ],
      },
      {
        name: "CK Total",
        clinicalNote:
          "Total Creatine Kinase (CK) measures the overall level of this enzyme found in heart, brain, and skeletal muscle. It is a general marker of muscle damage. When elevated, the CK-MB fraction helps determine whether the source is cardiac or skeletal muscle.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Low muscle mass (elderly, debilitated)",
              "Sedentary lifestyle",
              "Alcoholic liver disease",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Rhabdomyolysis (massive skeletal muscle breakdown)",
              "Vigorous exercise or physical trauma",
              "Myocardial infarction",
              "Myositis (inflammatory muscle disease)",
              "Intramuscular injections",
              "Statin-induced myopathy",
              "Hypothyroidism",
            ],
          },
        ],
      },
      {
        name: "LDH",
        clinicalNote:
          "Lactate Dehydrogenase (LDH) is an enzyme found in many body tissues including heart, liver, kidneys, muscles, and blood cells. It is released when cells are damaged. While non-specific, LDH is useful as a general marker of tissue damage and in monitoring certain conditions like haemolysis.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Generally not clinically significant",
              "Genetic variants with low activity (rare)",
              "Certain mutations affecting LDH subunits",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Haemolytic anaemia (red cell destruction)",
              "Myocardial infarction",
              "Liver disease (hepatitis, cirrhosis)",
              "Pulmonary embolism",
              "Malignancy (lymphoma, leukaemia — tumour marker)",
              "Megaloblastic anaemia (ineffective erythropoiesis)",
              "Muscle injury or rhabdomyolysis",
            ],
          },
        ],
      },
      {
        name: "BNP / NT-proBNP",
        clinicalNote:
          "BNP and NT-proBNP are peptides released by the heart ventricles in response to stretching caused by increased blood volume or pressure. They are the key biomarkers for diagnosing and monitoring heart failure. Higher levels correlate with greater severity of cardiac dysfunction.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Normal cardiac function",
              "Obesity (may produce falsely low values due to adipose tissue clearance)",
              "Flash pulmonary oedema (values may not have risen yet)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Heart failure (systolic or diastolic)",
              "Acute coronary syndrome",
              "Pulmonary embolism (right heart strain)",
              "Atrial fibrillation",
              "Valvular heart disease",
              "Pulmonary hypertension",
              "Chronic kidney disease (reduced clearance — interpret with age-adjusted cutoffs)",
            ],
          },
        ],
        footerNote:
          "BNP <100 pg/mL or NT-proBNP <300 pg/mL makes heart failure unlikely (high negative predictive value). Age-adjusted NT-proBNP cutoffs for acute heart failure: <50 years: >450 pg/mL, 50–75 years: >900 pg/mL, >75 years: >1800 pg/mL.",
      },
    ],
  },

  // ═══ Iron Studies (PT_IRON) ═════════════════════════════════════════
  {
    testCode: "PT_IRON",
    reportTitle: "Iron Studies (Serum Iron Profile)",
    reportIntro:
      "Iron Studies evaluate the body's iron status, including iron availability, transport capacity, storage, and utilisation. Iron is essential for haemoglobin production, oxygen transport, enzyme function, and DNA synthesis. This panel helps diagnose and differentiate between iron deficiency anaemia, anaemia of chronic disease, iron overload conditions (haemochromatosis), and other disorders of iron metabolism.",
    reportConclusion:
      "Iron study results should be interpreted as a pattern. Ferritin alone can be misleading as it is also an acute phase reactant (elevated in inflammation). Combining ferritin with transferrin saturation and serum iron provides the most accurate assessment of iron status. Clinical context including dietary history, menstrual status, and inflammation markers is essential.",
    parameters: [
      {
        name: "Serum Iron",
        clinicalNote:
          "Serum iron measures the amount of circulating iron bound to transferrin in the blood. Iron levels fluctuate throughout the day (highest in the morning) and are affected by recent dietary intake. It reflects iron availability for erythropoiesis but should not be used in isolation for diagnosis.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Iron deficiency anaemia (blood loss, poor intake, malabsorption)",
              "Anaemia of chronic disease (inflammation sequesters iron)",
              "Chronic infections",
              "Malabsorption (celiac disease, gastric bypass)",
              "Heavy menstruation or chronic GI bleeding",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hereditary haemochromatosis",
              "Iron poisoning / excessive iron supplementation",
              "Haemolytic anaemia (released from destroyed red cells)",
              "Transfusional iron overload (repeated transfusions)",
              "Liver disease (release from damaged hepatocytes)",
              "Ineffective erythropoiesis (thalassaemia major, sideroblastic anaemia)",
            ],
          },
        ],
      },
      {
        name: "TIBC",
        clinicalNote:
          "Total Iron Binding Capacity (TIBC) measures the blood's total capacity to bind and transport iron, which primarily reflects transferrin levels. TIBC is an indirect measure of transferrin production by the liver. It rises when iron stores are low as the body attempts to increase iron absorption.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Anaemia of chronic disease (inflammation reduces transferrin synthesis)",
              "Iron overload (haemochromatosis — reduced need for transport)",
              "Liver disease (impaired transferrin production)",
              "Nephrotic syndrome (transferrin loss in urine)",
              "Malnutrition (reduced protein synthesis)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Iron deficiency anaemia (compensatory increase in transferrin)",
              "Pregnancy (increased iron demand and transferrin production)",
              "Oral contraceptive use",
              "Acute hepatitis (liver releases transferrin)",
            ],
          },
        ],
      },
      {
        name: "Ferritin",
        clinicalNote:
          "Ferritin is the primary iron storage protein in the body. Serum ferritin levels reflect total body iron stores and are the most sensitive and specific single test for iron deficiency. However, ferritin is also an acute phase reactant that rises during inflammation, infection, and malignancy, which can mask underlying iron deficiency.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Iron deficiency (the most specific indicator — <12 ng/mL is diagnostic)",
              "Chronic blood loss (GI bleeding, menorrhagia)",
              "Inadequate dietary iron intake",
              "Malabsorption syndromes (celiac disease)",
              "Pregnancy (increased iron utilisation)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hereditary haemochromatosis",
              "Transfusional iron overload",
              "Acute or chronic inflammation (acute phase reactant)",
              "Liver disease (hepatitis, cirrhosis — release from hepatocytes)",
              "Malignancy (lymphoma, hepatocellular carcinoma)",
              "Haemophagocytic lymphohistiocytosis (HLH — very high ferritin)",
              "Adult-onset Still disease",
            ],
          },
        ],
        footerNote:
          "Ferritin <12 ng/mL is diagnostic of iron deficiency. In the setting of inflammation, ferritin <30–50 ng/mL may still indicate iron deficiency. A ferritin >1000 ng/mL warrants investigation for iron overload, liver disease, or malignancy.",
      },
      {
        name: "Transferrin Sat. %",
        clinicalNote:
          "Transferrin saturation represents the percentage of transferrin that is carrying iron. It is calculated from serum iron and TIBC. This ratio helps distinguish between different types of anaemia and is the best screening test for hereditary haemochromatosis.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Iron deficiency anaemia (<16% is suggestive)",
              "Anaemia of chronic disease",
              "Malabsorption or inadequate dietary iron",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Hereditary haemochromatosis (>45% is screening threshold)",
              "Iron overload from transfusions",
              "Haemolytic anaemia",
              "Sideroblastic anaemia",
              "Excessive iron supplementation",
            ],
          },
        ],
        footerNote:
          "Transferrin saturation <16% suggests iron deficiency. Transferrin saturation >45% warrants investigation for haemochromatosis (HFE gene testing). Morning fasting samples are preferred as iron levels have diurnal variation.",
      },
    ],
  },

  // ═══ ESR (PT_ESR) ══════════════════════════════════════════════════
  {
    testCode: "PT_ESR",
    reportTitle: "Erythrocyte Sedimentation Rate (ESR)",
    reportIntro:
      "The Erythrocyte Sedimentation Rate (ESR) measures how quickly red blood cells settle to the bottom of a test tube over one hour. When inflammation is present, proteins such as fibrinogen and immunoglobulins cause red blood cells to clump together and settle faster. ESR is a non-specific but useful marker for detecting and monitoring inflammation, infection, and autoimmune conditions.",
    reportConclusion:
      "ESR is a non-specific inflammatory marker and should be interpreted alongside clinical findings and other investigations (CRP, CBC). It may remain elevated for weeks after an acute event resolves. ESR naturally increases with age and is generally higher in females.",
    parameters: [
      {
        name: "ESR (Erythrocyte Sedimentation Rate)",
        clinicalNote:
          "ESR measures the rate at which red blood cells settle in a vertical tube, which increases when inflammatory proteins cause red cells to aggregate. It is one of the oldest and simplest laboratory tests for detecting inflammation. While non-specific, it remains valuable for diagnosing and monitoring conditions like temporal arteritis and polymyalgia rheumatica.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Polycythaemia (increased red cell mass slows sedimentation)",
              "Sickle cell disease (abnormal cell shape)",
              "Congestive heart failure (severe)",
              "Hypofibrinogenaemia",
              "Extreme leucocytosis",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Infections (bacterial, tuberculosis)",
              "Autoimmune diseases (rheumatoid arthritis, lupus)",
              "Temporal arteritis / giant cell arteritis (often >100 mm/hr)",
              "Polymyalgia rheumatica",
              "Malignancy (multiple myeloma, lymphoma)",
              "Chronic kidney disease",
              "Pregnancy (physiological increase)",
            ],
          },
        ],
        footerNote:
          "Age-adjusted upper limit approximation: Males = Age / 2; Females = (Age + 10) / 2. ESR >100 mm/hr strongly suggests serious underlying pathology (malignancy, infection, or autoimmune disease).",
      },
    ],
  },

  // ═══ CRP (PT_CRP) ═════════════════════════════════════════════════
  {
    testCode: "PT_CRP",
    reportTitle: "C-Reactive Protein (CRP)",
    reportIntro:
      "C-Reactive Protein (CRP) is an acute phase protein produced by the liver in response to inflammation. CRP levels rise rapidly within 6–8 hours of an inflammatory stimulus and can increase up to 1000-fold during severe infections. It is a more sensitive and faster-responding marker of inflammation than ESR, making it valuable for detecting acute infections, monitoring treatment response, and assessing inflammatory disease activity.",
    reportConclusion:
      "CRP is a sensitive but non-specific marker of inflammation. Elevated levels should prompt investigation for the underlying cause. Serial CRP measurements are valuable for monitoring treatment response — a declining trend indicates effective therapy. High-sensitivity CRP (hs-CRP) at lower levels is used for cardiovascular risk assessment.",
    parameters: [
      {
        name: "C-Reactive Protein (CRP)",
        clinicalNote:
          "CRP is produced by the liver in response to inflammation anywhere in the body. It rises rapidly during acute infection or inflammation and falls quickly once the condition resolves. CRP is widely used to detect infections, monitor disease activity, and assess response to treatment.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Normal finding — indicates no significant active inflammation",
              "Low levels are reassuring in the clinical context of infection screening",
              "Statin therapy may modestly reduce CRP levels",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Bacterial infections (often markedly elevated >50 mg/L)",
              "Autoimmune diseases (rheumatoid arthritis flare, lupus)",
              "Tissue injury (surgery, trauma, burns)",
              "Malignancy",
              "Acute myocardial infarction",
              "Inflammatory bowel disease (Crohn disease, ulcerative colitis)",
              "Viral infections (mild to moderate elevation)",
            ],
          },
        ],
        footerNote:
          "CRP levels guide clinical interpretation: <5 mg/L (normal), 5–50 mg/L (mild inflammation, viral infection), 50–200 mg/L (active inflammation, bacterial infection), >200 mg/L (severe bacterial infection, sepsis, major burns). For cardiovascular risk, hs-CRP is used: <1 mg/L (low risk), 1–3 mg/L (average risk), >3 mg/L (high risk).",
      },
    ],
  },

  // ═══ Vitamin D (PT_VIT_D) ══════════════════════════════════════════
  {
    testCode: "PT_VIT_D",
    reportTitle: "Vitamin D (25-Hydroxy Vitamin D)",
    reportIntro:
      "The 25-Hydroxy Vitamin D test measures the main circulating form of vitamin D in the blood. Vitamin D is essential for calcium absorption, bone health, immune function, and muscle strength. It is produced in the skin through sunlight exposure and obtained from dietary sources. Vitamin D deficiency is extremely common worldwide and is associated with osteoporosis, rickets, muscle weakness, increased infection risk, and various chronic diseases.",
    reportConclusion:
      "Vitamin D status should be interpreted alongside calcium, phosphate, and parathyroid hormone levels for a complete picture. Supplementation dosing depends on the degree of deficiency and underlying cause. Recheck levels after 8–12 weeks of supplementation to ensure adequate repletion.",
    parameters: [
      {
        name: "25-Hydroxy Vitamin D",
        clinicalNote:
          "25-Hydroxy Vitamin D (calcidiol) is the best indicator of overall vitamin D status as it reflects both dietary intake and skin production. It has a half-life of 2–3 weeks, making it a stable marker. The active form (1,25-dihydroxy vitamin D) is made in the kidneys but is not used for routine screening.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Inadequate sunlight exposure (indoor lifestyle, dark skin, high latitude)",
              "Poor dietary intake of vitamin D",
              "Malabsorption (celiac disease, Crohn disease, gastric bypass)",
              "Chronic kidney disease (impaired hydroxylation)",
              "Chronic liver disease",
              "Obesity (vitamin D sequestered in fat tissue)",
              "Medications (anticonvulsants, rifampicin — increase vitamin D catabolism)",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Excessive vitamin D supplementation",
              "Granulomatous diseases (sarcoidosis, tuberculosis — extrarenal 1-alpha hydroxylation)",
              "Williams syndrome (rare genetic condition)",
              "Certain lymphomas",
            ],
          },
        ],
        footerNote:
          "Vitamin D status classification: Severe deficiency <10 ng/mL, Deficiency 10–19 ng/mL, Insufficiency 20–29 ng/mL, Sufficient 30–100 ng/mL, Potential toxicity >100 ng/mL. The Endocrine Society recommends maintaining levels ≥30 ng/mL.",
      },
    ],
  },

  // ═══ Vitamin B12 (PT0805) ══════════════════════════════════════
  {
    testCode: "PT0805",
    reportTitle: "Vitamin B12 (Cobalamin)",
    reportIntro:
      "The Vitamin B12 test measures the level of cobalamin in the blood. Vitamin B12 is essential for DNA synthesis, red blood cell formation, neurological function, and methylation reactions throughout the body. It is obtained exclusively from animal-based foods and requires intrinsic factor (produced by the stomach) for absorption. Deficiency can cause megaloblastic anaemia and irreversible neurological damage if left untreated.",
    reportConclusion:
      "Borderline vitamin B12 levels (200–300 pg/mL) may still be associated with tissue-level deficiency. Methylmalonic acid (MMA) and homocysteine levels can help confirm functional B12 deficiency when serum levels are equivocal. Early detection and treatment are crucial to prevent irreversible neurological complications.",
    parameters: [
      {
        name: "Vitamin B12",
        clinicalNote:
          "Vitamin B12 (cobalamin) is vital for normal nerve function, red blood cell production, and DNA synthesis. The body stores several years' supply in the liver, so deficiency develops gradually. Symptoms of deficiency include fatigue, macrocytic anaemia, numbness and tingling, balance problems, and cognitive changes.",
        abnormalityNote: [
          {
            direction: "LOW",
            reasons: [
              "Pernicious anaemia (autoimmune destruction of intrinsic factor-producing cells)",
              "Strict vegan or vegetarian diet (no animal products)",
              "Malabsorption (celiac disease, Crohn disease, bacterial overgrowth)",
              "Gastric surgery (gastrectomy, bariatric surgery)",
              "Chronic atrophic gastritis (common in elderly)",
              "Medications (metformin, proton pump inhibitors — long-term use)",
              "Pancreatic insufficiency",
            ],
          },
          {
            direction: "HIGH",
            reasons: [
              "Excessive supplementation (oral or parenteral)",
              "Liver disease (B12 released from damaged hepatocytes)",
              "Chronic myeloproliferative disorders (increased transcobalamin)",
              "Renal failure (reduced clearance)",
              "Hepatocellular carcinoma",
            ],
          },
        ],
        footerNote:
          "Vitamin B12 interpretation: <150 pg/mL (definite deficiency — treat urgently), 150–200 pg/mL (probable deficiency — confirm with MMA/homocysteine), 200–300 pg/mL (borderline — may have tissue deficiency), >300 pg/mL (normal). Neurological symptoms may be irreversible if treatment is delayed.",
      },
    ],
  },

  // ═══ Complete Urine Examination (CUE / PT_CUE) ═══════════════════════════
  {
    testCode: "PT_CUE",
    reportTitle: "Complete Urine Examination (CUE)",
    reportIntro:
      "The Complete Urine Examination (CUE) is a comprehensive analysis of urine that provides valuable information about kidney function, metabolic disorders, and urinary tract health. It consists of three components: physical examination (colour, appearance, specific gravity, pH), chemical analysis (protein, glucose, ketones, blood, bilirubin, urobilinogen, leucocytes, nitrites), and microscopic examination of the urine sediment (cells, casts, crystals, bacteria). CUE is one of the most commonly ordered investigations and is an essential part of routine health screening, pre-operative evaluation, and monitoring of known renal or metabolic diseases.",
    reportConclusion:
      "Urine results should be interpreted in the context of clinical symptoms, hydration status, and concurrent medications. Significant abnormalities — particularly haematuria, proteinuria, glycosuria, or the presence of cellular casts — should be correlated with renal function tests and, if indicated, further specialised investigation including 24-hour urine protein, urine culture, or nephrology referral.",
    parameters: [
      {
        name: "Specific Gravity",
        clinicalNote:
          "Specific gravity reflects the kidney's ability to concentrate or dilute urine and indicates overall hydration and renal tubular function. Values between 1.003 and 1.030 are normal; concentrated urine (>1.020) indicates good concentrating ability or dehydration, while persistently dilute urine (<1.005) may suggest diabetes insipidus or renal tubular dysfunction.",
        abnormalityNote: [
          { direction: "LOW", reasons: ["Excess fluid intake", "Diabetes insipidus (central or nephrogenic)", "Renal tubular dysfunction", "Medications (diuretics)"] },
          { direction: "HIGH", reasons: ["Dehydration", "Fever or sweating", "Glycosuria (glucose adds to osmolality)", "Proteinuria (severe)", "SIADH"] },
        ],
      },
      {
        name: "Protein (Albumin)",
        clinicalNote:
          "The healthy kidney excretes very little protein (<150 mg/day). Detection of protein on dipstick typically indicates albuminuria and may reflect glomerular damage, tubular dysfunction, or overflow proteinuria. Trace or 1+ may occur with concentrated urine or after strenuous exercise (functional proteinuria).",
        abnormalityNote: [
          { direction: "HIGH", reasons: ["Glomerulonephritis (primary or secondary)", "Diabetic nephropathy", "Hypertensive nephropathy", "Nephrotic syndrome", "Urinary tract infection", "Pre-eclampsia (in pregnancy)", "Multiple myeloma (overflow proteinuria)", "Strenuous exercise (transient, benign)"] },
        ],
      },
      {
        name: "Glucose (Sugar)",
        clinicalNote:
          "Glucose appears in urine (glycosuria) when blood glucose exceeds the renal threshold (~180 mg/dL) or when renal tubular reabsorption is impaired. Glycosuria is an important clue to undiagnosed or poorly controlled diabetes mellitus.",
        abnormalityNote: [
          { direction: "HIGH", reasons: ["Uncontrolled diabetes mellitus", "Impaired glucose tolerance or gestational diabetes", "Renal glycosuria (normal blood glucose — tubular defect)", "Fanconi syndrome", "Steroid therapy", "Acute stress hyperglycaemia"] },
        ],
      },
      {
        name: "Pus Cells",
        clinicalNote:
          "Pus cells (white blood cells / leucocytes) in urine indicate inflammation in the urinary tract. 0–5 pus cells per HPF is normal. Elevated counts suggest infection or sterile pyuria from non-infectious inflammation.",
        abnormalityNote: [
          { direction: "HIGH", reasons: ["Urinary tract infection (UTI) — bacterial cystitis, pyelonephritis", "Urethritis (sexually transmitted infections)", "Renal tuberculosis (sterile pyuria)", "Interstitial nephritis", "Contamination during sample collection"] },
        ],
      },
      {
        name: "Red Blood Cells",
        clinicalNote:
          "Red blood cells in urine (haematuria) may be visible (gross haematuria) or detected only on microscopy (microscopic haematuria). Even 3 RBCs/HPF is considered significant and warrants further evaluation.",
        abnormalityNote: [
          { direction: "HIGH", reasons: ["Urinary tract infection", "Kidney stones (nephrolithiasis)", "Glomerulonephritis", "Renal or bladder tumours", "Trauma", "Anticoagulant therapy", "Benign prostatic hyperplasia", "Vigorous exercise (runner's haematuria)"] },
        ],
      },
      {
        name: "Bacteria",
        clinicalNote:
          "Bacteria in a properly collected midstream urine sample indicates urinary tract infection. Bacteriuria with pyuria strongly suggests active infection. Significant bacteriuria on microscopy (many bacteria) should prompt urine culture and sensitivity.",
        abnormalityNote: [
          { direction: "HIGH", reasons: ["Urinary tract infection (Escherichia coli most common)", "Pyelonephritis", "Contamination during sample collection (most common cause of false positive)"] },
        ],
      },
    ],
  },

  // ═══ FSH / LH (PT_FSH_LH) ══════════════════════════════════════════════
  {
    testCode: "PT_FSH_LH",
    reportTitle: "FSH & LH (Gonadotropin Panel)",
    reportIntro:
      "FSH (Follicle-Stimulating Hormone) and LH (Luteinising Hormone) are pituitary gonadotropins that regulate reproductive function. FSH stimulates follicular growth in females and spermatogenesis in males; LH triggers ovulation in females and testosterone production in males. Their measurement is critical in evaluating infertility, menstrual irregularities, hypogonadism, precocious or delayed puberty, and pituitary disorders. Results must be interpreted in relation to the phase of the menstrual cycle, age, and clinical context.",
    reportConclusion:
      "FSH and LH levels alone are not diagnostic; they must be interpreted alongside other hormones (Estradiol, Testosterone, AMH, Prolactin, TSH) and clinical findings. Menstrual phase at the time of blood draw significantly affects reference ranges for female patients. Serial measurements or dynamic testing (GnRH stimulation) may be required in borderline cases.",
    parameters: [
      {
        name: "FSH (Follicle Stimulating Hormone)",
        clinicalNote:
          "FSH is produced by the anterior pituitary and acts on the gonads to promote gamete development. In females, it is highest in the early follicular phase and peaks at ovulation. Elevated FSH (particularly >10 mIU/mL in a female of reproductive age) indicates diminished ovarian reserve and is a key marker of peri-menopause or premature ovarian insufficiency. In males, FSH drives spermatogenesis and elevated values indicate primary testicular failure.",
        abnormalityNote: [
          { direction: "LOW", reasons: ["Hypothalamic or pituitary dysfunction (hypogonadotropic hypogonadism)", "Hyperprolactinaemia", "Kallmann syndrome", "Severe systemic illness or malnutrition", "Anabolic steroid or exogenous sex hormone use"] },
          { direction: "HIGH", reasons: ["Premature ovarian insufficiency / menopause (female)", "Primary testicular failure — Klinefelter syndrome, orchitis, chemotherapy (male)", "Turner syndrome", "Normal peri-menopause / menopause", "Resistance to gonadotropins"] },
        ],
      },
      {
        name: "LH (Luteinising Hormone)",
        clinicalNote:
          "LH triggers the LH surge at mid-cycle in females, causing ovulation and formation of the corpus luteum. Sustained LH elevation throughout the cycle may indicate polycystic ovarian syndrome (PCOS) or primary gonadal failure. The LH:FSH ratio is diagnostically important — an LH:FSH ratio >2:1 in the early follicular phase strongly supports PCOS.",
        abnormalityNote: [
          { direction: "LOW", reasons: ["Hypothalamic hypogonadism (Kallmann syndrome, eating disorders)", "Hyperprolactinaemia", "Exogenous sex hormone / steroid use", "Pituitary adenoma or pituitary surgery"] },
          { direction: "HIGH", reasons: ["PCOS (elevated LH:FSH ratio, LH >10 mIU/mL in follicular phase)", "Primary gonadal failure (menopause, testicular failure)", "Precocious puberty (central)", "Resistance to sex hormones"] },
        ],
        footerNote:
          "LH:FSH Ratio Interpretation: Ratio >2 in early follicular phase — consider PCOS. Ratio <1 with elevated absolute values — consider primary gonadal failure.",
      },
    ],
  },

  // ═══ Lipid Profile (PT_LIPID) — already in templates, adding extra note here ══════
  // Already handled as PT0553 in the templates above.
];

/**
 * Seeds / updates test templates with clinical notes, abnormality notes,
 * report titles, intros, and conclusions for all known tests.
 */
export async function seedTestTemplates(
  prisma: PrismaService,
  tenantId: string,
): Promise<{ updated: string[]; notFound: string[] }> {
  const updated: string[] = [];
  const notFound: string[] = [];

  for (const template of TEST_TEMPLATES) {
    // Step 1: Find the test catalog entry by code
    let test = await prisma.testCatalog.findFirst({
      where: {
        tenantId,
        OR: [
          { code: template.testCode },
          {
            code: {
              contains: template.testCode.replace("PT_", ""),
              mode: "insensitive" as const,
            },
          },
        ],
      },
    });

    // Step 2: If not found by code, try keyword matching
    if (!test) {
      const keywordMatch = NAME_KEYWORD_MATCHES.find(
        (m) => m.configKey === template.testCode,
      );
      if (keywordMatch) {
        for (const keyword of keywordMatch.keywords) {
          test = await prisma.testCatalog.findFirst({
            where: {
              tenantId,
              name: { contains: keyword, mode: "insensitive" as const },
            },
          });
          if (test) break;
        }
      }
    }

    if (!test) {
      notFound.push(template.testCode);
      continue;
    }

    // Step 3: Update TestCatalog with report metadata
    await prisma.testCatalog.update({
      where: { id: test.id },
      data: {
        reportTitle: template.reportTitle,
        reportIntro: template.reportIntro,
        reportConclusion: template.reportConclusion,
        isTemplateComplete: true,
      },
    });

    // Step 4: Update each parameter's clinical and abnormality notes
    for (const paramTemplate of template.parameters) {
      await prisma.reportParameter.updateMany({
        where: {
          testCatalogId: test.id,
          name: paramTemplate.name,
        },
        data: {
          clinicalNote: paramTemplate.clinicalNote,
          abnormalityNote: JSON.stringify(paramTemplate.abnormalityNote),
          ...(paramTemplate.footerNote
            ? { footerNote: paramTemplate.footerNote }
            : {}),
        },
      });
    }

    updated.push(`${template.testCode} (${test.name})`);
  }

  return { updated, notFound };
}

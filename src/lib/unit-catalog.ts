import type { StudyModule, StudyUnit } from "../../types/spec";

export const STUDY_MODULES: StudyModule[] = [
  {
    id: 1,
    title: "Semiología de los Procesos y Funciones Psicológicas",
    unitIds: [1, 2, 3, 4, 5],
  },
  {
    id: 2,
    title: "Síndromes Psicopatológicos",
    unitIds: [6, 7, 8],
  },
];

export const STUDY_UNITS: StudyUnit[] = [
  { id: 1, moduleId: 1, order: 1, title: "Conciencia y Orientación" },
  { id: 2, moduleId: 1, order: 2, title: "Atención y Memoria" },
  { id: 3, moduleId: 1, order: 3, title: "Percepción e Imaginación" },
  { id: 4, moduleId: 1, order: 4, title: "Pensamiento y Lenguaje" },
  {
    id: 5,
    moduleId: 1,
    order: 5,
    title: "Afectividad, Motricidad y Funciones Fisiológicas",
  },
  { id: 6, moduleId: 2, order: 6, title: "Síndromes Orgánicos" },
  {
    id: 7,
    moduleId: 2,
    order: 7,
    title: "Síndromes Esquizofrénicos y Delirantes",
  },
  {
    id: 8,
    moduleId: 2,
    order: 8,
    title: "Síndromes Afectivos, Discinéticos y Otros",
  },
];

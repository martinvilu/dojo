/**
 * Diferencias entre el cronograma actual y una versión guardada u otra
 * cátedra, clase por clase. Una clase cuyo tema aparece en otra posición
 * del cronograma comparado se marca "movida" en lugar de "modificada".
 */
export interface DiffClass {
  topic?: string;
  type?: string;
  special_status?: string;
}

export type DiffStatus = "identical" | "modified" | "moved" | "added" | "removed";

export interface DiffItem<T extends DiffClass = DiffClass> {
  idx: number;
  status: DiffStatus;
  current: T | null;
  target: T | null;
  /** Para "moved": número de clase que tenía ese tema en el cronograma comparado. */
  movedFrom?: number;
}

const sameClass = (a: DiffClass, b: DiffClass) =>
  a.topic === b.topic && a.type === b.type && a.special_status === b.special_status;

export function diffSchedules<T extends DiffClass>(current: T[], target: T[]): DiffItem<T>[] {
  const topicIndex = new Map<string, number>();
  target.forEach((t, i) => {
    const topic = (t.topic || "").trim();
    if (topic && !topicIndex.has(topic)) topicIndex.set(topic, i);
  });

  const items: DiffItem<T>[] = [];
  const max = Math.max(current.length, target.length);
  for (let i = 0; i < max; i++) {
    const cur = current[i];
    const tgt = target[i];
    if (cur && tgt) {
      if (sameClass(cur, tgt)) {
        items.push({ idx: i + 1, status: "identical", current: cur, target: tgt });
        continue;
      }
      const from = topicIndex.get((cur.topic || "").trim());
      if (from !== undefined && from !== i) {
        items.push({ idx: i + 1, status: "moved", current: cur, target: tgt, movedFrom: from + 1 });
      } else {
        items.push({ idx: i + 1, status: "modified", current: cur, target: tgt });
      }
    } else if (cur) {
      items.push({ idx: i + 1, status: "added", current: cur, target: null });
    } else {
      items.push({ idx: i + 1, status: "removed", current: null, target: tgt });
    }
  }
  return items;
}

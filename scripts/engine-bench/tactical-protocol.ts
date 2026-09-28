// Pure prospective analysis only. This module neither reads nor generates validation data.
export type TacticalFlag = "material-loss" | "avoidable-loss" | "missed-win";
export function tacticalFlags(best: number, selected: number): TacticalFlag[] {
  if (!Number.isFinite(best) || !Number.isFinite(selected) || selected > best)
    throw new Error("Comparable moving-side reference scores are required");
  const flags: TacticalFlag[] = [];
  if (Math.abs(best) < 90000 && Math.abs(selected) < 90000 && best - selected >= 200)
    flags.push("material-loss");
  if (selected <= -90000 && best > -90000) flags.push("avoidable-loss");
  if (best >= 90000 && selected < 90000) flags.push("missed-win");
  return flags;
}
export function sharedTacticalFailure(
  depth3: readonly [number, number],
  depth4: readonly [number, number],
): boolean {
  const first = tacticalFlags(...depth3),
    second = tacticalFlags(...depth4);
  return first.some((flag) => second.includes(flag));
}
export interface FailureCluster {
  gameId: string;
  decisions: number;
  candidateFailures: number;
  baselineFailures: number;
}
export function clusteredFailureInterval(clusters: readonly FailureCluster[]) {
  if (
    !Array.isArray(clusters) ||
    !clusters.length ||
    Array.from(clusters).some(
      (cluster) =>
        !cluster ||
        typeof cluster.gameId !== "string" ||
        !cluster.gameId ||
        !Number.isSafeInteger(cluster.decisions) ||
        cluster.decisions <= 0 ||
        ![cluster.candidateFailures, cluster.baselineFailures].every(
          (count) => Number.isSafeInteger(count) && count >= 0 && count <= cluster.decisions,
        ),
    ) ||
    new Set(clusters.map((cluster) => cluster.gameId)).size !== clusters.length
  )
    throw new Error("Complete unique source-game clusters are required");
  const decisions = clusters.reduce((sum, cluster) => sum + cluster.decisions, 0);
  const maximumDraw =
    clusters.reduce((max, cluster) => Math.max(max, cluster.decisions), 0) * clusters.length;
  if (!Number.isSafeInteger(decisions) || !Number.isSafeInteger(maximumDraw))
    throw new Error("Aggregate decision count is out of range");
  const candidateRate =
    clusters.reduce((sum, cluster) => sum + cluster.candidateFailures, 0) / decisions;
  const baselineRate =
    clusters.reduce((sum, cluster) => sum + cluster.baselineFailures, 0) / decisions;
  let state = 0x29c0ffee;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const samples = Array.from({ length: 10000 }, () => {
    let count = 0,
      difference = 0;
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[Math.floor(random() * clusters.length)];
      count += cluster.decisions;
      difference += cluster.candidateFailures - cluster.baselineFailures;
    }
    return difference / count;
  }).sort((a, b) => a - b);
  return {
    games: clusters.length,
    decisions,
    candidateRate,
    baselineRate,
    difference: candidateRate - baselineRate,
    lower: samples[249],
    upper: samples[9749],
  };
}

import {
  cancelClueProblem,
  clueProblem,
  dialGuessProblem,
  giveClue,
  guessersOf,
  justOneClueProblem,
  manadaAnswerProblem,
  mergeGroups,
  recordAnswers,
  recordClues,
  regroupProblem,
  setClueCancelled,
  splitGroup,
  voteProblem,
  type GameConfigRequest,
  type GameType,
  type MatchPublic,
  type RoomSnapshot,
} from '@family-night/shared';

interface MatchStep {
  matchId: string;
  round: number;
}

export type Optimistic =
  | { kind: 'select-game'; game: GameType }
  | { kind: 'config'; request: GameConfigRequest }
  | { kind: 'host'; playerId: string }
  | { kind: 'kick'; playerId: string }
  | { kind: 'rename'; playerId: string; name: string }
  | (MatchStep & { kind: 'impostor-confirm'; voterId: string; targetId: string })
  | (MatchStep & { kind: 'wavelength-clue'; psychicId: string; clue: string })
  | (MatchStep & { kind: 'wavelength-commit'; playerId: string })
  | (MatchStep & { kind: 'justone-clue'; playerId: string })
  | (MatchStep & {
      kind: 'justone-cancel';
      playerId: string;
      authorId: string;
      cancelled: boolean;
    })
  | (MatchStep & { kind: 'manada-answer'; playerId: string })
  | (MatchStep & { kind: 'manada-merge'; groupIds: [string, string] })
  | (MatchStep & { kind: 'manada-split'; groupId: string });

type MatchOptimistic = Extract<Optimistic, MatchStep>;

function applyToMatch(match: MatchPublic, step: MatchOptimistic): MatchPublic {
  switch (step.kind) {
    case 'impostor-confirm': {
      if (match.gameType !== 'IMPOSTOR') return match;
      if (voteProblem(match, step.voterId, step.targetId, step.round)) return match;
      const voters = new Set([...match.votedPlayerIds, step.voterId]);
      return { ...match, votedPlayerIds: match.order.filter((id) => voters.has(id)) };
    }
    case 'wavelength-clue':
      if (match.gameType !== 'WAVELENGTH') return match;
      if (clueProblem(match, step.psychicId, step.round)) return match;
      return giveClue(match, step.clue);
    case 'wavelength-commit': {
      if (match.gameType !== 'WAVELENGTH') return match;
      if (dialGuessProblem(match, step.playerId, step.round)) return match;
      const committed = new Set([...match.committedPlayerIds, step.playerId]);
      return { ...match, committedPlayerIds: guessersOf(match).filter((id) => committed.has(id)) };
    }
    case 'justone-clue':
      if (match.gameType !== 'JUST_ONE') return match;
      if (justOneClueProblem(match, step.playerId, step.round)) return match;
      return recordClues(match, [...match.committedPlayerIds, step.playerId]);
    case 'justone-cancel':
      if (match.gameType !== 'JUST_ONE') return match;
      if (cancelClueProblem(match, step.playerId, step.round, step.authorId)) return match;
      return setClueCancelled(match, step.authorId, step.cancelled);
    case 'manada-answer':
      if (match.gameType !== 'MANADA') return match;
      if (manadaAnswerProblem(match, step.playerId, step.round)) return match;
      return recordAnswers(match, [...match.answeredPlayerIds, step.playerId]);
    case 'manada-merge':
      if (match.gameType !== 'MANADA') return match;
      if (regroupProblem(match, step.round, step.groupIds)) return match;
      return mergeGroups(match, ...step.groupIds);
    case 'manada-split':
      if (match.gameType !== 'MANADA') return match;
      if (regroupProblem(match, step.round, [step.groupId])) return match;
      return splitGroup(match, step.groupId);
  }
}

export function applyOptimistic(snapshot: RoomSnapshot, step: Optimistic): RoomSnapshot {
  switch (step.kind) {
    case 'select-game':
      return { ...snapshot, selectedGame: step.game };
    case 'config':
      return {
        ...snapshot,
        selectedGame: step.request.gameType,
        configs: { ...snapshot.configs, [step.request.gameType]: step.request.config },
      };
    case 'host':
      return { ...snapshot, hostId: step.playerId };
    case 'kick':
      return {
        ...snapshot,
        members: snapshot.members.filter((member) => member.playerId !== step.playerId),
      };
    case 'rename':
      return {
        ...snapshot,
        members: snapshot.members.map((member) =>
          member.playerId === step.playerId ? { ...member, name: step.name } : member,
        ),
      };
    default: {
      const match = snapshot.currentMatch;
      if (match?.matchId !== step.matchId) return snapshot;
      const next = applyToMatch(match, step);
      return next === match ? snapshot : { ...snapshot, currentMatch: next };
    }
  }
}

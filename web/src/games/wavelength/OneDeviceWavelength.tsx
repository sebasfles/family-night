import {
  DIAL_MAX,
  MIN_WAVELENGTH_PLAYERS,
  ONE_DEVICE_MAX_PLAYERS,
  type Spectrum,
} from '@family-night/shared';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { HandOff } from '../../components/HandOff';
import { useEnterKey } from '../../components/keys';
import { DialIcon } from '../../components/icons';
import { MatchHeader } from '../../components/MatchHeader';
import { nameOf } from '../../components/match';
import { PlayerSetup } from '../../components/PlayerSetup';
import { cryptoRandomInt } from '../../components/random';
import { Enter } from '../../motion/motion';
import { Dial } from './Dial';
import {
  clearOneDeviceMatch,
  clueGiven,
  confirmGuess,
  finishOneDevice,
  loadOneDeviceMatch,
  loadUsedSpectra,
  nextGuesser,
  nextOneDeviceRound,
  revealOneDevice,
  roundsPlayed,
  saveOneDeviceMatch,
  saveUsedSpectra,
  startOneDevice,
  type Drawn,
  type OneDeviceMatch,
} from './oneDevice';
import { RoundResult } from './RoundResult';
import { SoundToggle } from './SoundToggle';
import { Standings } from './Standings';
import { useDialSound } from './tick';

interface OneDeviceWavelengthProps {
  spectra: readonly Spectrum[];
  onBack: () => void;
  onHome: () => void;
}

export function OneDeviceWavelength({ spectra, onBack, onHome }: OneDeviceWavelengthProps) {
  const [state, setState] = useState(loadOneDeviceMatch);

  const update = (next: OneDeviceMatch) => {
    setState(next);
    if (next.match.phase === 'FINISHED') clearOneDeviceMatch();
    else saveOneDeviceMatch(next);
  };

  const drawn = ({ state: next, usedSpectrumIds }: Drawn) => {
    saveUsedSpectra(usedSpectrumIds);
    update(next);
  };

  const start = (names: readonly string[]) => {
    drawn(
      startOneDevice(names, {
        spectra,
        usedSpectrumIds: loadUsedSpectra(),
        randomInt: cryptoRandomInt,
        matchId: crypto.randomUUID(),
      }),
    );
  };

  if (!state) {
    return (
      <Enter
        as="main"
        className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6 md:max-w-2xl"
      >
        <PlayerSetup
          game="Wavelength"
          min={MIN_WAVELENGTH_PLAYERS}
          max={ONE_DEVICE_MAX_PLAYERS}
          onStart={start}
          onBack={onBack}
        />
      </Enter>
    );
  }

  return (
    <OneDeviceMatchScreen
      key={state.match.matchId}
      state={state}
      onChange={update}
      onNextRound={() => {
        drawn(
          nextOneDeviceRound(state, {
            spectra,
            usedSpectrumIds: loadUsedSpectra(),
            randomInt: cryptoRandomInt,
          }),
        );
      }}
      onRematch={() => {
        start(state.players.map((player) => player.name));
      }}
      onHome={onHome}
    />
  );
}

interface OneDeviceMatchScreenProps {
  state: OneDeviceMatch;
  onChange: (state: OneDeviceMatch) => void;
  onNextRound: () => void;
  onRematch: () => void;
  onHome: () => void;
}

function OneDeviceMatchScreen({
  state,
  onChange,
  onNextRound,
  onRematch,
  onHome,
}: OneDeviceMatchScreenProps) {
  const [open, setOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const { match, players } = state;
  const { phase, round } = match;
  const name = (playerId: string) => nameOf(players, playerId);
  const psychic = name(match.psychicId);
  const guesser = phase === 'GUESS' ? nextGuesser(state) : null;
  const step = `${phase}-${String(round)}-${guesser ?? ''}-${String(open)}`;
  const played = roundsPlayed(match);
  const finish = () => {
    setConfirmEnd(false);
    setOpen(false);
    onChange(finishOneDevice(state));
  };

  return (
    <Enter
      as="main"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6 md:max-w-3xl lg:max-w-5xl"
    >
      <MatchHeader
        round={round}
        finished={phase === 'FINISHED'}
        subtitle={
          phase === 'FINISHED'
            ? `Wavelength, ${played === 1 ? '1 ronda' : `${String(played)} rondas`}`
            : `Psíquico: ${psychic}`
        }
        badge={null}
        canAbort={phase !== 'FINISHED'}
        aborting={false}
        abortTitle={
          phase === 'REVEAL'
            ? '¿Terminar la partida?'
            : '¿Terminar la partida? Esta ronda no suma puntos.'
        }
        onAbort={finish}
      />

      <Enter
        key={step}
        className={`flex flex-1 flex-col gap-6 ${phase === 'REVEAL' || phase === 'FINISHED' ? '' : 'md:justify-center'}`}
      >
        {phase === 'CLUE' &&
          (open ? (
            <PsychicLook
              state={state}
              onDone={() => {
                setOpen(false);
                onChange(clueGiven(state));
              }}
            />
          ) : (
            <HandOff
              playerId={match.psychicId}
              name={psychic}
              title={`Le toca a ${psychic}`}
              hint="Eres el psíquico: mira el objetivo sin que nadie más vea la pantalla."
              action="Ver el objetivo"
              onReady={() => {
                setOpen(true);
              }}
            />
          ))}

        {phase === 'GUESS' &&
          guesser &&
          (open ? (
            <GuesserDial
              key={guesser}
              state={state}
              guesser={name(guesser)}
              psychic={psychic}
              onConfirm={(value) => {
                setOpen(false);
                onChange(confirmGuess(state, value));
              }}
            />
          ) : (
            <HandOff
              playerId={guesser}
              name={name(guesser)}
              title={`Pasa el dispositivo a ${name(guesser)}`}
              hint={`Solo ${name(guesser)} mira la pantalla y mueve el dial.`}
              action={`Soy ${name(guesser)}`}
              onReady={() => {
                setOpen(true);
              }}
            />
          ))}

        {phase === 'GUESS' && !guesser && (
          <AllGuessed
            onReveal={() => {
              onChange(revealOneDevice(state));
            }}
          />
        )}

        {phase === 'REVEAL' && (
          <section
            aria-labelledby="reveal-title"
            className="flex flex-col gap-6 md:grid md:grid-cols-2 md:grid-rows-[auto_1fr] md:items-start md:gap-x-10 md:[&>:nth-child(2)]:row-span-2"
          >
            <RoundResult titleId="reveal-title" match={match} players={players} selfId="" />
            <div className="flex flex-col gap-3">
              <Button onClick={onNextRound}>Siguiente ronda</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmEnd(true);
                }}
              >
                Terminar
              </Button>
            </div>
          </section>
        )}

        {phase === 'FINISHED' && (
          <section
            aria-labelledby="final-title"
            className="flex flex-col gap-6 md:grid md:grid-cols-2 md:grid-rows-[auto_1fr] md:items-start md:gap-x-10 md:[&>:nth-child(2)]:row-span-2"
          >
            <Standings titleId="final-title" match={match} players={players} selfId="" />
            <div className="flex flex-col gap-3">
              <Button onClick={onRematch}>Jugar otra vez</Button>
              <Button variant="ghost" onClick={onHome}>
                Volver al inicio
              </Button>
            </div>
          </section>
        )}
      </Enter>

      {confirmEnd && (
        <ConfirmDialog
          title="¿Terminar la partida?"
          confirmLabel="Sí, terminar"
          onConfirm={finish}
          onCancel={() => {
            setConfirmEnd(false);
          }}
        />
      )}
    </Enter>
  );
}

const SPLIT =
  'flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-[1fr_auto_1fr] md:gap-x-10';
const SIDE_TOP = 'md:col-start-1 md:row-start-2';
const SIDE_BOTTOM = 'md:col-start-1 md:row-start-3 md:self-start';
const MAIN = 'md:col-start-2 md:row-span-3 md:row-start-1 md:self-center';

function AllGuessed({ onReveal }: { onReveal: () => void }) {
  useEnterKey(onReveal);
  return (
    <section
      aria-labelledby="all-guessed-title"
      className="flex w-full max-w-lg flex-col items-center gap-6 self-center surface px-6 py-8 text-center md:gap-8 md:px-10 md:py-12"
    >
      <span className="flex size-20 items-center justify-center rounded-full bg-moon/14 text-moon">
        <DialIcon className="size-12" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 id="all-guessed-title" className="text-3xl font-bold md:text-4xl">
          Todos adivinaron
        </h2>
        <p className="text-lg text-balance text-cream/80">
          Pongan el dispositivo donde todos lo vean.
        </p>
      </div>
      <Button className="w-full" onClick={onReveal}>
        Revelar
      </Button>
    </section>
  );
}

function PsychicLook({ state, onDone }: { state: OneDeviceMatch; onDone: () => void }) {
  useEnterKey(onDone);
  const { left, right } = state.match.spectrum;
  return (
    <section aria-labelledby="psychic-title" className={SPLIT}>
      <div
        className={`flex items-center gap-4 surface p-4 md:flex-col md:items-start md:p-6 ${SIDE_TOP}`}
      >
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-moon/14 text-moon">
          <DialIcon className="size-9" />
        </span>
        <div className="flex flex-col gap-0.5 md:gap-2">
          <h2 id="psychic-title" className="text-2xl font-bold md:text-3xl">
            Eres el psíquico
          </h2>
          <p className="text-base text-cream/80 md:text-lg">
            Di en voz alta una pista para que lleguen al centro de la zona.
          </p>
        </div>
      </div>
      <div className={MAIN}>
        <Dial label="El objetivo" left={left} right={right} target={state.target} />
      </div>
      <Button className={`md:w-full ${SIDE_BOTTOM}`} onClick={onDone}>
        Listo
      </Button>
    </section>
  );
}

interface GuesserDialProps {
  state: OneDeviceMatch;
  guesser: string;
  psychic: string;
  onConfirm: (value: number) => void;
}

function GuesserDial({ state, guesser, psychic, onConfirm }: GuesserDialProps) {
  const [value, setValue] = useState(DIAL_MAX / 2);
  const [sound, toggleSound] = useDialSound();
  const { left, right } = state.match.spectrum;
  const confirm = () => {
    onConfirm(value);
  };
  return (
    <section aria-labelledby="dial-title" className={SPLIT}>
      <div
        className={`flex flex-col items-center gap-1 text-center md:items-start md:gap-2 md:text-left ${SIDE_TOP}`}
      >
        <h2 id="dial-title" className="text-3xl font-bold break-words md:text-4xl">
          {guesser}, mueve el dial
        </h2>
        <p className="text-lg text-balance text-cream/80">¿Adónde apunta la pista de {psychic}?</p>
        <p className="hidden text-base text-cream/60 lg:block">
          Con el teclado: flechas para moverlo, Enter para confirmar.
        </p>
      </div>
      <div className={`flex flex-col gap-2 ${MAIN}`}>
        <SoundToggle sound={sound} onToggle={toggleSound} />
        <Dial
          label="Tu respuesta"
          left={left}
          right={right}
          value={value}
          sound={sound}
          autoFocus
          onChange={setValue}
          onSubmit={confirm}
        />
      </div>
      <Button className={`md:w-full ${SIDE_BOTTOM}`} onClick={confirm}>
        Confirmar
      </Button>
    </section>
  );
}

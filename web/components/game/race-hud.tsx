import { memo } from "react";

/**
 * The DOM half of the game, ported from the prototype's index.html.
 *
 * `game/ui/hud.ts` finds these nodes by id and drives them imperatively: it
 * writes the per-character spans into #promptText, appends a tick per landmark
 * into #rail, and toggles classes on #promptBox. Text this size is sharper in
 * DOM than on the canvas, it reflows for free, and it stays selectable. Only
 * things attached to the ship itself (name tag, hull and speed bars) are drawn
 * in the scene, because those have to travel with it.
 *
 * Memoised with no props so it renders exactly once. That is load-bearing rather
 * than an optimisation: React does not own the children the HUD writes into
 * these nodes, and a re-render risks throwing them away mid-race.
 *
 * The dev panel from the prototype is deliberately absent. rules/game-presentation.md
 * calls the tunable physics block a development affordance and not a shipping
 * feature, and `Hud` treats every part of it as optional.
 */
export const RaceHud = memo(function RaceHud() {
  return (
    <div className="race-hud">
      <div id="statsBar">
        <div>
          WPM <b id="statWpm">0</b>
        </div>
        <div>
          ACCURACY <b id="statAcc">100%</b>
        </div>
        <div>
          DISTANCE <b id="statDist">0%</b>
        </div>
      </div>

      <div id="rail">
        <div className="finish" />
        <div id="railMarker" />
      </div>

      <div id="promptBox">
        <div id="promptText" />
        {/*
          Static markup, so the arc animations keep running instead of restarting
          every time the countdown ticks. The arcs crawl the border rather than
          crossing the panel: bolts drawn through the middle read as a lattice
          over the words, and the whole point of this state is that the sentence
          stays readable.
        */}
        <div id="stallFx" aria-hidden="true">
          <svg viewBox="0 0 700 120" preserveAspectRatio="none">
            <path d="M40 4 L92 -4 L140 10 L196 -2 L248 6" />
            <path d="M452 6 L508 -4 L556 10 L612 -2 L664 5" />
            <path d="M36 116 L90 124 L138 108 L194 120 L246 113" />
            <path d="M456 113 L510 122 L558 107 L614 119 L666 114" />
            <path d="M8 22 L-4 48 L14 72 L2 100" />
            <path d="M692 20 L704 46 L686 72 L698 98" />
          </svg>
        </div>
        <div id="stallBadge">
          <i className="spark" />
          HULL BREACH <b id="stallTimer">5.0s</b>
        </div>
      </div>

      <div id="hint">
        Build speed and stay consistent. Stop typing and you fall back to a crawl.
      </div>

      <div id="endScreen">
        <h1 id="endTitle">You crossed the heliopause</h1>
        <div className="row" id="endStats" />
        <button id="btnPlayAgain" type="button">
          Play again
        </button>
      </div>
    </div>
  );
});

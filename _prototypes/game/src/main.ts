import { Color, DisplayMode, Engine } from 'excalibur';
import { RaceScene } from './scenes/RaceScene';
import { loader } from './resources';

/**
 * HelioTyper, ported from the single-file canvas prototype onto ExcaliburJS and
 * the generated art in assets/.
 *
 * The resolution is fixed and the display mode fits it to the screen while
 * filling any leftover space, so the 1280x720 frame is always fully visible and a
 * wider window just sees more sky. Every layout constant can therefore stay a
 * plain number instead of a fraction of an unknown viewport.
 */
const engine = new Engine({
  canvasElementId: 'game',
  resolution: { width: 1280, height: 720 },
  displayMode: DisplayMode.FitScreenAndFill,
  backgroundColor: Color.fromHex('#05060a'),
  // The art is anti-aliased software-rastered output, not pixel art.
  antialiasing: true,
  pixelArt: false,
  suppressPlayButton: true,
  // Typing is read straight off the DOM keydown event, so Excalibur does not need
  // to swallow keys of its own.
  suppressConsoleBootMessage: true,
});

const scene = new RaceScene();
engine.addScene('race', scene);

void engine.start('race', { loader });

import { COMBO, COMBO_CALLOUTS, SCORE } from '../config.js';

// Combo- und Punkte-Logik nach den Icy-Tower-Regeln, ohne Phaser-Abhängigkeit.
//
// - Ein Combo-Sprung überwindet mindestens COMBO.minFloors Etagen.
// - Die Combo läuft weiter, solange der nächste Combo-Sprung innerhalb von
//   COMBO.timer Sekunden erfolgt.
// - Sie endet bei einem kürzeren Sprung oder wenn der Timer abläuft.
// - Gewertet wird sie nur ab COMBO.minJumps Combo-Sprüngen: Punkte = Etagen².
export class ComboTracker {
  constructor(onComboEnd = () => {}) {
    this.onComboEnd = onComboEnd;
    this.lastFloor = 0;
    this.maxFloor = 0;
    this.baseFloor = 0; // Punkte zählen ab dieser Etage (Himmelreich-Direktstart)
    this.comboPoints = 0;
    this.bestCombo = 0;
    this.active = false;
    this.floors = 0;
    this.jumps = 0;
    this.timeLeft = 0;
  }

  get score() {
    return (this.maxFloor - this.baseFloor) * SCORE.perFloor + this.comboPoints;
  }

  /** Timer herunterzählen; beendet die Combo, wenn er abläuft. */
  update(dt) {
    if (!this.active) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.end();
  }

  /** Aufrufen, wenn die Figur auf Etage `floor` landet. */
  land(floor) {
    const delta = floor - this.lastFloor;
    this.lastFloor = floor;
    if (floor > this.maxFloor) this.maxFloor = floor;

    if (delta >= COMBO.minFloors) {
      if (!this.active) {
        this.active = true;
        this.floors = 0;
        this.jumps = 0;
      }
      this.floors += delta;
      this.jumps += 1;
      this.timeLeft = COMBO.timer;
    } else if (this.active) {
      this.end();
    }
  }

  /** Beendet eine laufende Combo (auch beim Game Over aufrufen). */
  end() {
    if (!this.active) return null;
    this.active = false;
    this.timeLeft = 0;
    const counted = this.jumps >= COMBO.minJumps;
    const result = {
      floors: this.floors,
      jumps: this.jumps,
      counted,
      points: counted ? this.floors * this.floors : 0,
      callout: counted ? calloutFor(this.floors) : null,
    };
    if (counted) {
      this.comboPoints += result.points;
      if (this.floors > this.bestCombo) this.bestCombo = this.floors;
    }
    this.floors = 0;
    this.jumps = 0;
    this.onComboEnd(result);
    return result;
  }
}

export function calloutFor(floors) {
  for (const [min, text] of COMBO_CALLOUTS) if (floors >= min) return text;
  return null;
}

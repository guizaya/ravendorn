import {
  TRAINING_DUMMY_BLUEPRINTS,
  createTrainingDummy,
} from "../../data/enemies/index.js";

export function createTrainingDummies() {
  return TRAINING_DUMMY_BLUEPRINTS.map(createTrainingDummy);
}

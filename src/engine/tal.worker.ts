import { chooseTalMove } from "./roster/tal";
import { installRosterWorker } from "./roster/worker";
installRosterWorker("tal", chooseTalMove);

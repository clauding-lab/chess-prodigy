import { chooseFischerMove } from "./roster/fischer";
import { installRosterWorker } from "./roster/worker";
installRosterWorker("fischer", chooseFischerMove);

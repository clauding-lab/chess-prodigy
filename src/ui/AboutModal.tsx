import { version } from "../../package.json";
import { Modal } from "./Modal";

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About Chess Prodigy" onClose={onClose}>
      <p>Version {version}</p>
      <p>Developed by Adnan Rashid.</p>
      <p>
        <a
          className="linkbtn"
          href="https://github.com/clauding-lab/chess-prodigy"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </p>
      <button className="btn primary" onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}

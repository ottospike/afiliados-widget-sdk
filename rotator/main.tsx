import { createRoot } from "react-dom/client";
import Rotator from "./Rotator";
import { watchVersion } from "../_shared/failsafe";

// Widget servido same-origin sob /widgets/overlay/<id>/ (e alias legado /widgets/embed/<id>/)
// — QR via ?aff=&dest=&mode= da própria URL do embed (ver Rotator.tsx), demais dados via
// proxies relativos. watchVersion deriva o id do pathname (/overlay|embed/<id>/).
createRoot(document.getElementById("root")!).render(<Rotator />);
watchVersion(); // reload (fadeout) quando o admin trocar/mandar recarregar este widget

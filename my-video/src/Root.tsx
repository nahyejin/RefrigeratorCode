import "./index.css";
import { Composition } from "remotion";
import { CookMatchTeaser } from "./CookMatchTeaser";
import { Reel1Receipt, REEL1_TOTAL_FRAMES } from "./Reel1Receipt";
import { Reel2Match, REEL2_TOTAL_FRAMES } from "./Reel2Match";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CookMatchTeaser"
        component={CookMatchTeaser}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel1Receipt"
        component={Reel1Receipt}
        durationInFrames={REEL1_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel2Match"
        component={Reel2Match}
        durationInFrames={REEL2_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

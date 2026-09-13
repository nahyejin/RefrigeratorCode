import "./index.css";
import { Composition } from "remotion";
import { CookMatchTeaser } from "./CookMatchTeaser";
import { Reel1Receipt, REEL1_TOTAL_FRAMES } from "./Reel1Receipt";
import { Reel2Match, REEL2_TOTAL_FRAMES } from "./Reel2Match";
import { Reel3CookMode, REEL3_TOTAL_FRAMES } from "./Reel3CookMode";
import { Reel4AiDiet, REEL4_TOTAL_FRAMES } from "./Reel4AiDiet";
import { Reel5ExpiryAlert, REEL5_TOTAL_FRAMES } from "./Reel5ExpiryAlert";
import { Reel6ChatbotDemo, REEL6_TOTAL_FRAMES } from "./Reel6ChatbotDemo";

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
      <Composition
        id="Reel3CookMode"
        component={Reel3CookMode}
        durationInFrames={REEL3_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel4AiDiet"
        component={Reel4AiDiet}
        durationInFrames={REEL4_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel5ExpiryAlert"
        component={Reel5ExpiryAlert}
        durationInFrames={REEL5_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel6ChatbotDemo"
        component={Reel6ChatbotDemo}
        durationInFrames={REEL6_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

import "./index.css";
import { Composition, Folder } from "remotion";
import { CookMatchTeaser } from "./CookMatchTeaser";

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
      <Folder name="NewFolder" />
    </>
  );
};

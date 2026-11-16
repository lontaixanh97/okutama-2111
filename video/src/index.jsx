import React, { useEffect, useState } from "react";
import { Composition, continueRender, delayRender, registerRoot } from "remotion";
import "@fontsource/dela-gothic-one/latin.css";
import "@fontsource/dela-gothic-one/latin-ext.css";
import "@fontsource/dela-gothic-one/vietnamese.css";
import "@fontsource/dela-gothic-one/japanese.css";
import "@fontsource-variable/bricolage-grotesque/index.css";
import { Trailer, FPS, W, H, DURATION } from "./Trailer";

const SAMPLE = "奥多摩紅葉新宿立川青梅湖駅 Hẹn ở sân ga đỏ lá ngắm xuôi dốc Một ngày 0123456789:.,";

const Root = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load('400 48px "Dela Gothic One"', SAMPLE),
      document.fonts.load('400 24px "Bricolage Grotesque Variable"', SAMPLE),
      document.fonts.load('700 24px "Bricolage Grotesque Variable"', SAMPLE),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle));
  }, [handle]);

  return (
    <Composition
      id="Trailer"
      component={Trailer}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={DURATION}
    />
  );
};

registerRoot(Root);

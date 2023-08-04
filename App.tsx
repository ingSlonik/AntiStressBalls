import React, { useState, useEffect, useRef, useCallback, MutableRefObject } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableNativeFeedback,
  Button,
  Platform,
  NativeModules,
  GestureResponderEvent,
  LayoutChangeEvent,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Svg, Circle as SvgCircle, LinearGradient, Defs, Stop, Rect } from "react-native-svg";

import { accelerometer } from "react-native-sensors";

import { version } from "./package.json";

type Size = {
  width: number,
  height: number,
};
type Vec2 = {
  x: number,
  y: number,
};
type Circle = {
  color: string,
  radius: number,
  position: Vec2,
  oldPosition: Vec2,
  acceleration: Vec2,
};

const isIOS = Platform.OS === "ios";
const deviceLanguage: string =
  isIOS
    ? NativeModules.SettingsManager.settings.AppleLocale ||
    NativeModules.SettingsManager.settings.AppleLanguages[0] // iOS 13
    : NativeModules.I18nManager.localeIdentifier;
const isCS = deviceLanguage.toLocaleLowerCase().includes("cs") || deviceLanguage.toLocaleLowerCase().includes("cz");

const en = {
  title: "Anti-stress balls",
  up: "Up",
  down: "Down",
  color: "Color",
  count: "Count",
  restart: "Restart",
  block: "Blocks",
};
const cs = {
  title: "Antistresové koule",
  up: "Nahoru",
  down: "Dolů",
  color: "Barva",
  count: "Počet",
  restart: "Ještě jednou",
  block: "Bloků",
};

const lang = isCS ? cs : en;

const colors = {
  main: "#4794ff",
  backgroundPrimary: "#333333",
  backgroundSecondary: "#000000",
};

const maxCircleRadius = 24;
const maxCircleDiameter = maxCircleRadius * 2;
const maxVelocity = maxCircleRadius;

const resistance = 0.995;



function changeGravity(gravity: Vec2, x: number, y: number) {
  gravity.x = x;
  gravity.y = y;
}

function applyGravity(gravity: Vec2, circles: Circle[]) {
  for (const circle of circles) {
    circle.acceleration.x += gravity.x;
    circle.acceleration.y += gravity.y;
  }
}

type ColorPalette = "rgb" | "gray" | "white";

function getColor(palette: ColorPalette, scale: number) {
  switch (palette) {
    case "rgb":
      return getColorRGB(scale);
    case "gray":
      return getColorGray(scale);
    case "white":
      return getColorWhite(scale);
  }
}

function getColorRGB(scale: number) {
  const r = Math.floor(Math.sin(scale * Math.PI * 2) * 127 + 127);
  const g = Math.floor(Math.sin(scale * Math.PI * 2 + 2 * Math.PI / 3) * 127 + 127);
  const b = Math.floor(Math.sin(scale * Math.PI * 2 + 4 * Math.PI / 3) * 127 + 127);

  return `rgb(${r}, ${g}, ${b})`;
}
function getColorGray(scale: number) {
  const c = Math.floor(scale * 255) % 255;

  return `rgb(${c}, ${c}, ${c})`;
}
function getColorWhite(_scale: number) {
  return "rgb(255, 255, 255)";
}


function createCircle(palette: ColorPalette, scale: number): Circle {
  return {
    position: {
      x: 28,
      y: 32,
    },
    oldPosition: {
      x: 24,
      y: 32,
    },
    acceleration: {
      x: 0,
      y: 0,
    },
    radius: Math.random() * 12 + 12,
    color: getColor(palette, scale),
  };
}

function restart(circleRef: MutableRefObject<Circle[]>) {
  circleRef.current.splice(0, circleRef.current.length);
}

function moveCircle(circle: Circle, newPosition: Vec2) {
  circle.position = newPosition;
}

function solveCirclesCollision(circles: Circle[], potentialCircles: Circle[]) {
  for (const circle of circles) {
    for (const potentialCircle of potentialCircles) {

      if (circle !== potentialCircle) {
        const diff: Vec2 = {
          x: circle.position.x - potentialCircle.position.x,
          y: circle.position.y - potentialCircle.position.y,
        };

        //if (Math.abs(diff.x) < maxCircleDiameter && Math.abs(diff.y) < maxCircleDiameter) {
        if (
          diff.x < maxCircleDiameter
          && diff.x > -maxCircleDiameter
          && diff.y < maxCircleDiameter
          && diff.y > -maxCircleDiameter
        ) {
          const distance = Math.sqrt(Math.pow(diff.x, 2) + Math.pow(diff.y, 2));
          const delta = (circle.radius + potentialCircle.radius) - distance;

          // is collision
          if (delta > 0) {
            const direction: Vec2 = {
              x: diff.x / distance,
              y: diff.y / distance,
            };
            moveCircle(circle, {
              x: circle.position.x + 0.5 * delta * direction.x,
              y: circle.position.y + 0.5 * delta * direction.y,
            });
            moveCircle(potentialCircle, {
              x: potentialCircle.position.x - 0.5 * delta * direction.x,
              y: potentialCircle.position.y - 0.5 * delta * direction.y,
            });
          }
        }
      }
    }
  }
}

function solveBlocksCollision(blocks: Circle[], circles: Circle[]) {
  for (const circle of circles) {
    for (const block of blocks) {

      const diff: Vec2 = {
        x: circle.position.x - block.position.x,
        y: circle.position.y - block.position.y,
      };

      if (
        diff.x < maxCircleDiameter
        && diff.x > -maxCircleDiameter
        && diff.y < maxCircleDiameter
        && diff.y > -maxCircleDiameter
      ) {
        const distance = Math.sqrt(Math.pow(diff.x, 2) + Math.pow(diff.y, 2));
        const delta = (circle.radius + block.radius) - distance;

        // is collision
        if (delta > 0) {
          const direction: Vec2 = {
            x: diff.x / distance,
            y: diff.y / distance,
          };
          moveCircle(circle, {
            x: circle.position.x + 1 * delta * direction.x,
            y: circle.position.y + 1 * delta * direction.y,
          });
        }
      }
    }
  }
}

function bounceCircles(circle: Circle, direction: "x" | "y") {
  const { position, oldPosition } = circle;
  if (direction === "x") {
    const aux = position.x;
    position.x = oldPosition.x;
    oldPosition.x = aux;
  } else {
    const aux = position.y;
    position.y = oldPosition.y;
    oldPosition.y = aux;
  }
}

function solveWallsBounceCollision({ width, height }: Size, circles: Circle[]) {
  for (const circle of circles) {
    const { position, oldPosition, radius } = circle;
    if (position.x < radius) {
      if (oldPosition.x <= radius) {
        position.x = radius;
      } else {
        bounceCircles(circle, "x");
      }
    } else if (position.x > width - radius) {
      if (oldPosition.x >= width - radius) {
        position.x = width - radius;
      } else {
        bounceCircles(circle, "x");
      }
    }
    if (position.y < radius) {
      if (oldPosition.y <= radius) {
        position.y = radius;
      } else {
        bounceCircles(circle, "y");
      }
    } else if (position.y > height - radius) {
      if (oldPosition.y >= height - radius) {
        position.y = height - radius;
      } else {
        bounceCircles(circle, "y");
      }
    }
  }
}

function updateCircles(circles: Circle[], dt: number) {
  for (const circle of circles) {
    const velocity: Vec2 = {
      x: circle.position.x - circle.oldPosition.x,
      y: circle.position.y - circle.oldPosition.y,
    };

    // fix crazy balls
    if (velocity.x > maxVelocity) velocity.x = maxVelocity;
    if (velocity.x < -maxVelocity) velocity.x = -maxVelocity;
    if (velocity.y > maxVelocity) velocity.y = maxVelocity;
    if (velocity.y < -maxVelocity) velocity.y = -maxVelocity;

    const dt2 = Math.pow(dt, 2);
    circle.oldPosition = circle.position;

    moveCircle(circle, {
      x: circle.position.x + (velocity.x + circle.acceleration.x * dt2) * resistance,
      y: circle.position.y + (velocity.y + circle.acceleration.y * dt2) * resistance,
    });
    circle.acceleration = { x: 0, y: 0 };
  }
}

let timeLastFrame = new Date().getTime();

function run(size: Size, gravity: Vec2, circles: Circle[], blocks: Circle[]) {
  const timeNow = new Date().getTime();
  const dt = (timeNow - timeLastFrame) / 1000; // [s]
  timeLastFrame = timeNow;

  const dtUpdate = dt < 0.1 ? dt : 0.1;
  applyGravity(gravity, circles);
  updateCircles(circles, dtUpdate * 10);
  for (let i = 0; i < 4; i++) {
    solveCirclesCollision(circles, circles);
    solveBlocksCollision(blocks, circles);
    solveWallsBounceCollision(size, circles);
  }
}


export default function App(): JSX.Element {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [showMenu, setShowMenu] = useState(false);
  const [colorPalette, setColorPalette] = useState<ColorPalette>("rgb");

  const [count, setCount] = useState(10);
  const [blockCount, setBlockCount] = useState(0);

  const circlesRef = useRef<Circle[]>([]);
  const blocksRef = useRef<Circle[]>([]);

  useEffect(() => {
    if (count < circlesRef.current.length) {
      circlesRef.current.splice(count, circlesRef.current.length - count);
    }
  }, [count]);
  useEffect(() => {
    if (blockCount < blocksRef.current.length) {
      blocksRef.current.splice(blockCount, blocksRef.current.length - blockCount);
    }
    for (let i = blocksRef.current.length; i < blockCount; i++) {
      blocksRef.current.push({
        position: {
          x: 0.5 * size.width,
          y: 0.5 * size.height,
        },
        oldPosition: {
          x: 0.5 * size.width,
          y: 0.5 * size.height,
        },
        radius: 24,
        acceleration: { x: 0, y: 0 },
        color: "#000000",
      });
    }
  }, [blockCount, size]);

  const styleWidth = { width: size.width };

  function handleSize(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height)
      setSize({ width, height });
  }

  return <SafeAreaView style={styles.container}>
    <StatusBar
      barStyle={"light-content"}
      backgroundColor={"black"}
    />
    <Text style={styles.title}>{lang.title}</Text>
    <View
      style={styles.body}
      onLayout={handleSize}
    >
      <Balls
        circleCount={count}
        size={size}
        colorPalette={colorPalette}
        circlesRef={circlesRef}
        blocksRef={blocksRef}
      />
    </View>

    {showMenu && <View style={[styles.menu, styleWidth]}>

      <Text style={styles.text}>{lang.count}: {count}</Text>
      <Slider
        value={count}
        onValueChange={setCount}
        minimumValue={1}
        maximumValue={50}
        step={1}
        thumbTintColor={colors.main}
        minimumTrackTintColor={colors.main + "C0"}
        maximumTrackTintColor={colors.main + "80"}
      />

      <Text style={styles.text}>{lang.block}: {blockCount}</Text>
      <Slider
        value={blockCount}
        onValueChange={setBlockCount}
        minimumValue={0}
        maximumValue={5}
        step={1}
        thumbTintColor={colors.main}
        minimumTrackTintColor={colors.main + "C0"}
        maximumTrackTintColor={colors.main + "80"}
      />

      <Text style={styles.text}>{lang.color}:</Text>
      <View style={styles.row}>
        <ColorButton color="white" active={colorPalette === "white"} onPress={() => setColorPalette("white")} />
        <ColorButton color="gray" active={colorPalette === "gray"} onPress={() => setColorPalette("gray")} />
        <ColorButton color="rgb" active={colorPalette === "rgb"} onPress={() => setColorPalette("rgb")} />
      </View>

      <Button color={colors.main} title={lang.restart} onPress={() => restart(circlesRef)} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Filip Paulů - v{version}</Text>
      </View>
    </View>}

    <View style={styles.fab}>
      <TouchableNativeFeedback onPress={() => setShowMenu(sm => !sm)}>
        <View style={styles.fabButton}>
          <Text style={styles.text}>{showMenu ? lang.down : lang.up}</Text>
        </View>
      </TouchableNativeFeedback>
    </View>
  </SafeAreaView>;
}

type ColorButtonProps = {
  color: ColorPalette,
  active: boolean,
  onPress: () => void,
};
function ColorButton({ color, active, onPress }: ColorButtonProps) {
  const style = {
    padding: 4,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: active ? colors.main : "transparent",
  };

  return <TouchableNativeFeedback onPress={onPress}>
    <View style={style}>
      <Svg height={24} width={64}>
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0" stopColor={getColor(color, 0)} />
            <Stop offset="0.1" stopColor={getColor(color, 0.1)} />
            <Stop offset="0.2" stopColor={getColor(color, 0.2)} />
            <Stop offset="0.3" stopColor={getColor(color, 0.3)} />
            <Stop offset="0.4" stopColor={getColor(color, 0.4)} />
            <Stop offset="0.5" stopColor={getColor(color, 0.5)} />
            <Stop offset="0.6" stopColor={getColor(color, 0.6)} />
            <Stop offset="0.7" stopColor={getColor(color, 0.7)} />
            <Stop offset="0.8" stopColor={getColor(color, 0.8)} />
            <Stop offset="0.9" stopColor={getColor(color, 0.9)} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grad)" />
      </Svg>
    </View>
  </TouchableNativeFeedback>;
}

type BallsProps = {
  circleCount: number,
  size: Size,
  colorPalette: ColorPalette,
  circlesRef: MutableRefObject<Circle[]>,
  blocksRef: MutableRefObject<Circle[]>,
};

function Balls({ circleCount, size, colorPalette, circlesRef, blocksRef }: BallsProps): JSX.Element {
  const gravityRef = useRef<Vec2>({ x: 0, y: 10 });

  const [time, setTime] = useState(new Date().getTime());

  useEffect(() => {
    const circles = circlesRef.current;

    // add circle each 200ms
    const interval = setInterval(() => {
      if (circles.length < circleCount) {
        circles.push(createCircle(colorPalette, circles.length / circleCount));
      }
    }, 200);

    try {
      const subscription = accelerometer.subscribe(acl => {
        if (isIOS) {
          changeGravity(gravityRef.current, 10 * acl.x, -10 * acl.y);
        } else {
          changeGravity(gravityRef.current, -acl.x, acl.y);
        }
      });

      return () => {
        subscription.unsubscribe();
        clearInterval(interval);
      };
    } catch (e) {
      console.log("Accelerometer not supported");
      return () => {
        clearInterval(interval);
      };
    }
  }, [circleCount, colorPalette, circlesRef]);

  useEffect(() => {
    const circles = circlesRef.current;
    const blocks = blocksRef.current;
    run(size, gravityRef.current, circles, blocks);
    requestAnimationFrame(() => setTime(new Date().getTime()));
  }, [time, size, circlesRef, blocksRef]);

  const refPosition = useRef<Vec2>({ x: 0, y: 0 });
  const setNewRefPosition = useCallback((newPosition: Vec2) => {
    refPosition.current.x = newPosition.x;
    refPosition.current.y = newPosition.y;
  }, []);
  const handleMoveBlock = useCallback((e: GestureResponderEvent, block: Circle) => {
    const newRefPosition = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
    };
    const newPosition = {
      x: block.position.x + newRefPosition.x - refPosition.current.x,
      y: block.position.y + newRefPosition.y - refPosition.current.y,
    };
    if (newPosition.x < 0) newPosition.x = 0;
    if (newPosition.y < 0) newPosition.y = 0;
    if (newPosition.x > size.width) newPosition.x = size.width;
    if (newPosition.y > size.height) newPosition.y = size.height;

    moveCircle(block, newPosition);
    setNewRefPosition(newRefPosition);
  }, [size, setNewRefPosition]);

  return <Svg style={styles.balls} height={size.height} width={size.width}>
    {circlesRef.current.map((circle, index) => <SvgCircle
      key={index}
      cx={circle.position.x}
      cy={circle.position.y}
      r={circle.radius}
      fill={circle.color}
    />)}
    {blocksRef.current.map((block, index) => <SvgCircle
      key={index}
      cx={block.position.x}
      cy={block.position.y}
      r={block.radius}
      fill={block.color}
      stroke={"#888888"}
      strokeWidth={1}
      onPressIn={e => setNewRefPosition({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
      onResponderMove={e => handleMoveBlock(e, block)}
    />)}
  </Svg>;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  title: {
    color: "white",
    textAlign: "center",
  },
  body: {
    flexGrow: 1,
    margin: 8,
    backgroundColor: colors.backgroundPrimary,
    borderRadius: 8,
  },
  menu: {
    position: "absolute",
    bottom: 0,
    left: 8,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  balls: {
    position: "absolute", // iOS fix
  },
  text: {
    color: "white",
  },
  fab: {
    position: "absolute",
    bottom: 8,
    right: 8,
    borderRadius: 16,
    overflow: "hidden",
  },
  fabButton: {
    backgroundColor: colors.backgroundPrimary + "80",
    padding: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 12,
  },
  footerText: {
    color: "#888888",
    fontStyle: "italic",
    fontSize: 12,
  },
});

import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";

type Props = { size?: number };

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 resolution;
uniform float time;

float sphere(vec3 p, float r) {
  return length(p) - r;
}

vec3 shade(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec3 n = normalize(p);
  vec3 light = normalize(vec3(0.45, 0.7, 0.55));
  float ndl = clamp(dot(n, light), 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 2.4);
  float spec = pow(clamp(dot(reflect(-light, n), -rd), 0.0, 1.0), 28.0);
  vec3 glass = vec3(0.12, 0.09, 0.08);
  vec3 core = vec3(0.64, 0.16, 0.14);
  vec3 gold = vec3(0.74, 0.50, 0.01);
  float pulse = 0.55 + 0.45 * sin(time * 1.6);
  vec3 col = glass * (0.25 + 0.75 * ndl);
  col += core * pulse * pow(clamp(1.0 - length(p) * 1.35, 0.0, 1.0), 2.0);
  col += gold * fres;
  col += vec3(1.0, 0.94, 0.82) * spec;
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
  float a = time * 0.35;
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec3 ro = vec3(0.0, 0.05, 2.35);
  vec3 rd = normalize(vec3(uv, -1.35));
  ro.xz = rot * ro.xz;
  rd.xz = rot * rd.xz;

  float t = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 48; i++) {
    float d = sphere(ro + rd * t, 0.72);
    if (d < 0.001) { hit = 1.0; break; }
    t += d;
    if (t > 6.0) break;
  }

  vec3 col = vec3(0.0);
  if (hit > 0.5) col = shade(ro, rd, t);
  gl_FragColor = vec4(col, hit);
}
`;

function compile(gl: ExpoWebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

export default function Orb({ size = 220 }: Props) {
  const frame = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const started = Date.now();
    const draw = () => {
      if (!alive.current) return;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(time, (Date.now() - started) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      frame.current = requestAnimationFrame(draw);
    };
    draw();
  };

  return (
    <View style={{ width: size, height: size }}>
      <GLView style={styles.gl} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  gl: { flex: 1, backgroundColor: "transparent" },
});

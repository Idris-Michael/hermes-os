import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroScreenProps {
  onEnter: () => void;
}

const VERT_SRC = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG_SRC = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform sampler2D u_video;

  vec3 chromaticAberration(sampler2D tex, vec2 uv, float strength) {
    float r = texture2D(tex, uv + vec2(strength, 0.0)).r;
    float g = texture2D(tex, uv).g;
    float b = texture2D(tex, uv - vec2(strength, 0.0)).b;
    return vec3(r, g, b);
  }

  float scanline(vec2 uv, float time) {
    float lines = sin(uv.y * 800.0) * 0.04;
    float scroll = sin(uv.y * 200.0 - time * 2.0) * 0.015;
    return lines + scroll;
  }

  float vignette(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    return 1.0 - dot(uv * vec2(0.7, 0.9), uv * vec2(0.7, 0.9));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv.y = 1.0 - uv.y;

    float aberration = 0.003 + sin(u_time * 0.3) * 0.001;
    vec3 color = chromaticAberration(u_video, uv, aberration);

    color -= scanline(uv, u_time);
    color *= vignette(uv);

    // Desaturate toward mono, keep warm tones
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum), color, 0.55);
    color *= vec3(1.05, 0.98, 0.88); // warm tint

    // Pull blacks deep
    color = pow(max(color, 0.0), vec3(1.18));

    gl_FragColor = vec4(color, 1.0);
  }
`;

function initGL(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
  const gl = canvas.getContext("webgl");
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const pos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uRes = gl.getUniformLocation(prog, "u_resolution");
  const uTime = gl.getUniformLocation(prog, "u_time");
  gl.uniform1i(gl.getUniformLocation(prog, "u_video"), 0);

  return { gl, tex, uRes, uTime };
}

export default function IntroScreen({ onEnter }: IntroScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(undefined);
  const [ready, setReady] = useState(false);
  const [titleDone, setTitleDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = initGL(canvas, video);
    if (!ctx) return;
    const { gl, tex, uRes, uTime } = ctx;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();

    const tick = () => {
      if (video.readyState >= 2) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (performance.now() - start) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    video.addEventListener("canplay", () => {
      setReady(true);
      video.play().catch(() => {});
      tick();
    });

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const titleChars = "SEVERUS OVERWATCH".split("");

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: "#000" }}>
      {/* Hidden video source */}
      <video
        ref={videoRef}
        src="/intro.mp4"
        muted
        loop
        playsInline
        className="hidden"
      />

      {/* WebGL canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Letterbox bars */}
      <div className="absolute inset-x-0 top-0 h-[12%]" style={{ background: "#000" }} />
      <div className="absolute inset-x-0 bottom-0 h-[12%]" style={{ background: "#000" }} />

      {/* Gold corner accents */}
      {[
        "top-[12%] left-4",
        "top-[12%] right-4",
        "bottom-[12%] left-4",
        "bottom-[12%] right-4",
      ].map((pos, i) => (
        <motion.div
          key={i}
          className={`absolute w-8 h-8 ${pos}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
          style={{
            borderTop: i < 2 ? "1px solid #C9A84C" : "none",
            borderBottom: i >= 2 ? "1px solid #C9A84C" : "none",
            borderLeft: i % 2 === 0 ? "1px solid #C9A84C" : "none",
            borderRight: i % 2 === 1 ? "1px solid #C9A84C" : "none",
          }}
        />
      ))}

      {/* Gold scan line sweep */}
      <AnimatePresence>
        {ready && (
          <motion.div
            className="absolute inset-x-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, #C9A84C, transparent)", top: "12%" }}
            initial={{ scaleX: 0, opacity: 0.8 }}
            animate={{ scaleX: 1, opacity: 0 }}
            transition={{ duration: 1.4, delay: 0.3, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* Title */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none">
        <div className="flex gap-0 overflow-hidden">
          {titleChars.map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 20 }}
              transition={{ delay: 0.5 + i * 0.04, duration: 0.4, ease: "easeOut" }}
              onAnimationComplete={() => {
                if (i === titleChars.length - 1) setTitleDone(true);
              }}
              style={{
                fontFamily: "monospace",
                fontSize: "clamp(1.4rem, 3.5vw, 3rem)",
                fontWeight: 700,
                letterSpacing: "0.3em",
                color: "#C9A84C",
                textShadow: "0 0 30px rgba(201,168,76,0.5), 0 0 60px rgba(201,168,76,0.2)",
                whiteSpace: "pre",
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: titleDone ? 0.4 : 0, scaleX: titleDone ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          style={{ height: 1, width: "clamp(200px, 30vw, 500px)", background: "#C9A84C" }}
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: titleDone ? 0.5 : 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontFamily: "monospace",
            fontSize: "clamp(0.6rem, 1.2vw, 0.85rem)",
            letterSpacing: "0.5em",
            color: "#94a3b8",
            textTransform: "uppercase",
          }}
        >
          London · 2026 · Agentic Intelligence
        </motion.p>
      </div>

      {/* Enter button */}
      <AnimatePresence>
        {titleDone && (
          <motion.div
            className="absolute bottom-[18%] inset-x-0 flex justify-center pointer-events-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={onEnter}
              className="group relative px-12 py-3 font-mono text-xs tracking-[0.4em] uppercase transition-all duration-300"
              style={{ color: "#C9A84C", border: "1px solid rgba(201,168,76,0.4)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,168,76,0.1)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(201,168,76,0.4)";
              }}
            >
              [ ENTER ]
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle noise overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          opacity: 0.35,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}

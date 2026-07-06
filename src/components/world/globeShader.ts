import * as THREE from 'three';
import {
	HEMISPHERE_COLORS,
	MAX_CRACK_SEGMENTS,
	MAX_FEATURES,
	MAX_RIVER_SEGMENTS,
	buildCrackUniformArrays,
	buildFeatureUniformArrays,
	buildRiverUniformArrays,
} from './worldGlobeConfig';
import { createEntityGlowUniforms, type EntityGlowUniforms } from './entityGlowUniforms';

function hexToVec3(hex: string): THREE.Vector3 {
	const c = new THREE.Color(hex);
	return new THREE.Vector3(c.r, c.g, c.b);
}

/**
 * Fungsi bersama antara vertex & fragment shader — noise dan seni bina
 * mercu tanda perlu konsisten antara dua peringkat (vertex menonjolkan
 * bentuk 3D, fragment mewarnakannya) supaya bonjolan dan warna sepadan
 * tepat pada kedudukan yang sama.
 */
const sharedGlsl = /* glsl */ `
#define MAX_GLOWS 24
#define MAX_FEATURES 24
#define MAX_CRACK_SEGMENTS 26
#define MAX_RIVER_SEGMENTS 10

uniform float uTime;
uniform int uFeatureCount;
uniform vec3 uFeatureDirs[MAX_FEATURES];
uniform float uFeatureType[MAX_FEATURES];
uniform float uFeatureRadius[MAX_FEATURES];
uniform float uFeatureHeightScale[MAX_FEATURES];
uniform float uFeatureRingMode[MAX_FEATURES];
uniform float uFeatureRingWidth[MAX_FEATURES];
uniform float uFeaturePeakSharpness[MAX_FEATURES];
uniform float uFeatureSnowCap[MAX_FEATURES];
uniform float uFeatureCrystalVein[MAX_FEATURES];
uniform float uFeatureRaggedness[MAX_FEATURES];
uniform vec3 uCrackA[MAX_CRACK_SEGMENTS];
uniform vec3 uCrackB[MAX_CRACK_SEGMENTS];
uniform float uCrackWidth[MAX_CRACK_SEGMENTS];
uniform vec3 uCrackBoundDirs[2];
uniform float uCrackBoundRadius[2];

/** Tapisan murah (dot product) sebelum gelung 26 segmen retak — elak
 * overhead dinilai di merata permukaan yang jauh daripada mana-mana rekahan. */
bool nearAnyCrackBound(vec3 n) {
	for (int i = 0; i < 2; i++) {
		if (dot(n, uCrackBoundDirs[i]) > cos(uCrackBoundRadius[i])) return true;
	}
	return false;
}
uniform vec3 uRiverASegA[MAX_RIVER_SEGMENTS];
uniform vec3 uRiverASegB[MAX_RIVER_SEGMENTS];
uniform float uRiverAWidth[MAX_RIVER_SEGMENTS];
uniform vec3 uRiverBSegA[MAX_RIVER_SEGMENTS];
uniform vec3 uRiverBSegB[MAX_RIVER_SEGMENTS];
uniform float uRiverBWidth[MAX_RIVER_SEGMENTS];
uniform vec3 uRiverABoundDir;
uniform float uRiverABoundRadius;
uniform vec3 uRiverBBoundDir;
uniform float uRiverBBoundRadius;

float hash(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float n000 = hash(i);
	float n100 = hash(i + vec3(1.0, 0.0, 0.0));
	float n010 = hash(i + vec3(0.0, 1.0, 0.0));
	float n110 = hash(i + vec3(1.0, 1.0, 0.0));
	float n001 = hash(i + vec3(0.0, 0.0, 1.0));
	float n101 = hash(i + vec3(1.0, 0.0, 1.0));
	float n011 = hash(i + vec3(0.0, 1.0, 1.0));
	float n111 = hash(i + vec3(1.0, 1.0, 1.0));
	vec3 u = f;
	return mix(
		mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
		mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
		u.z
	);
}

/** Versi murah fbm (2 oktaf) — untuk tekstur mercu tanda supaya kos
 * per-piksel/per-verteks tidak melonjak dengan banyak mercu tanda aktif. */
float fbm2(vec3 p) {
	float v = noise(p) * 0.5;
	v += noise(p * 2.1) * 0.25;
	return v;
}

/** Pecahkan simetri bulat sempurna satu ciri jadi beberapa "puncak" tidak
 * sekata + rabung berbatu — gunung ragged, bukan kon/kubah tunggal generik.
 * raggedness 0 = tiada kesan (mix() balik ke 1.0); ke arah 1 = kesan penuh. */
float raggedMultiplier(vec3 n, vec3 dir, float radius, float raggedness) {
	if (raggedness < 0.001) return 1.0;
	vec3 upRefR = abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
	vec3 tuR = normalize(cross(upRefR, dir));
	vec3 tvR = cross(dir, tuR);
	vec2 pR = vec2(dot(n, tuR), dot(n, tvR));
	float azimuth = atan(pR.y, pR.x);
	float lobes = 0.5 + 0.5 * sin(azimuth * 5.0 + fbm2(dir * 7.0) * 6.283);
	float jagNoise = fbm2(vec3(pR * (5.0 / max(radius, 0.001)), 0.0) + dir * 9.0);
	float shaped = mix(0.45, 1.3, lobes * 0.6 + jagNoise * 0.4);
	return mix(1.0, shaped, raggedness);
}

float distToSegment(vec3 p, vec3 a, vec3 b) {
	vec3 ab = b - a;
	float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
	return distance(p, a + ab * t);
}

/**
 * Ketinggian relief pada satu titik permukaan — gunung menonjol keluar,
 * rekahan menakik ke dalam mengikut rangkaian retak sebenar (bukan bulatan),
 * air jadi lembangan cetek, kawasan lain dapat bonjolan halus. Dipanggil
 * dari vertex shader (anjakan verteks sebenar) supaya bentuknya 3D
 * sesungguhnya, bukan sekadar warna dicat di atas sfera licin.
 */
float terrainHeight(vec3 n) {
	float h = (fbm2(n * 6.0) - 0.5) * 0.014;

	for (int i = 0; i < MAX_FEATURES; i++) {
		if (i >= uFeatureCount) break;
		vec3 dir = uFeatureDirs[i];
		float t = uFeatureType[i];
		float radius = uFeatureRadius[i];
		float heightScale = uFeatureHeightScale[i];
		bool ringMode = uFeatureRingMode[i] > 0.5;
		float ringWidth = uFeatureRingWidth[i];
		float align = dot(n, dir);
		float outerReach = ringMode ? (radius + ringWidth * 2.0) : radius;
		if (align < cos(outerReach * 1.7)) continue;

		float falloff;
		if (ringMode) {
			// Banjaran/benteng gunung berbentuk GEGELANG — tinggi pada jejari
			// sudut ~radius sahaja (bukan kubah penuh dari pusat), supaya
			// bacaannya "terrain ditinggikan mengelilingi lembah/puncak".
			float angDist = acos(clamp(align, -1.0, 1.0));
			falloff = 1.0 - smoothstep(0.0, ringWidth, abs(angDist - radius));
		} else {
			// Jarak SUDUT sebenar (bukan align/cos yg pekat berhampiran pusat —
			// cos() kekal hampir 1 sepanjang sebahagian besar jejari lalu jatuh
			// mendadak dekat tepi, punca bentuk "gemuk"/mesa rata berdinding
			// tegak walaupun dgn peakSharpness). Guna t linear ikut jarak sudut
			// supaya cerun sekata merentasi KESELURUHAN jejari (masih peralihan
			// LEBAR, elak artifak cincin/tangga sfera rendah-poligon).
			float angDist = acos(clamp(align, -1.0, 1.0));
			float t2 = clamp(angDist / radius, 0.0, 1.0);
			float domeFalloff = 1.0 - smoothstep(0.0, 1.0, t2);
			// peakSharpness > 1 menajamkan lagi puncak jadi tirus/runcing; < 1
			// melebarkan jadi lebih rata.
			falloff = pow(domeFalloff, uFeaturePeakSharpness[i]);
		}

		// Gunung ragged (cth. Obsidian Hollow) — pecahkan simetri bulat
		// sempurna jadi beberapa puncak tidak sekata + rabung berbatu.
		falloff *= raggedMultiplier(n, dir, radius, uFeatureRaggedness[i]);

		if (t < 1.5) {
			// heightScale > 1 utk gunung yang mesti "paling tinggi" (cth.
			// Obsidian Hollow) berbanding gunung biasa jenis sama.
			h += falloff * 0.1 * heightScale;
		} else if (t < 2.5) {
			// heightScale > 1 utk lembangan yang mesti lebih DALAM (cth.
			// lembah tasik Heartbloom Isle) berbanding air biasa.
			h -= falloff * 0.03 * heightScale;
		} else if (t < 5.5) {
			h += falloff * 0.014 * heightScale;
		} else if (t < 6.5) {
			h += falloff * 0.075 * heightScale;
		} else if (t < 7.5) {
			// Selat Equilara — lembangan cetek sama macam air biasa.
			h -= falloff * 0.03 * heightScale;
		} else if (t < 8.5) {
			// Mendari — plaza/jalan rata, bonjolan halus sahaja.
			h += falloff * 0.012 * heightScale;
		} else {
			// Padang rumput (meadow) — sama lembut spt 'green' generik.
			h += falloff * 0.014 * heightScale;
		}
	}

	if (nearAnyCrackBound(n)) {
		// max() bukan tambah — dekat pusat rekahan, beberapa retakan utama
		// bertemu pada satu titik; kalau ditambah, indentasi bertindih
		// bertindan jadi lubang yang jauh lebih dalam daripada yang dirancang.
		float crackDepth = 0.0;
		for (int i = 0; i < MAX_CRACK_SEGMENTS; i++) {
			float w = uCrackWidth[i];
			if (w < 0.0001) continue;
			float d = distToSegment(n, uCrackA[i], uCrackB[i]);
			crackDepth = max(crackDepth, smoothstep(w * 2.2, w * 0.2, d));
		}
		h -= crackDepth * 0.045;
	}

	return h;
}

/**
 * Normal terganggu (bump normal) melalui pembezaan analitik terrainHeight
 * pada dua arah tangen — BUKAN terbitan skrin (dFdx/dFdy), yang didapati
 * menghasilkan normal rosak/NaN pada persekitaran ini (permukaan hitam
 * besar berbentuk poligon). Kaedah ini lebih mahal sedikit (tiga panggilan
 * terrainHeight) tetapi selamat dari segi matematik dan cuma dijalankan
 * per-verteks (bukan per-piksel), jadi kosnya kecil.
 */
vec3 computeDisplacedNormal(vec3 n, float h0) {
	vec3 upRef = abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
	vec3 tu = normalize(cross(upRef, n));
	vec3 tv = cross(n, tu);
	float eps = 0.015;

	vec3 n1 = normalize(n + tu * eps);
	vec3 n2 = normalize(n + tv * eps);
	float h1 = terrainHeight(n1);
	float h2 = terrainHeight(n2);

	vec3 p0 = n * (1.0 + h0);
	vec3 p1 = n1 * (1.0 + h1);
	vec3 p2 = n2 * (1.0 + h2);

	vec3 result = normalize(cross(p1 - p0, p2 - p0));
	if (dot(result, n) < 0.0) result = -result;
	return result;
}
`;

export const globeVertexShader = /* glsl */ `
${sharedGlsl}

varying vec3 vObjectNormal;
varying vec3 vViewDir;

void main() {
	vec3 n = normalize(normal);
	float disp = terrainHeight(n);
	vec3 displaced = position + normal * disp;

	vObjectNormal = computeDisplacedNormal(n, disp);
	vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
	vViewDir = normalize(cameraPosition - worldPos.xyz);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

export const globeFragmentShader = /* glsl */ `
${sharedGlsl}

uniform float uProximity;
uniform vec3 uLuminara;
uniform vec3 uNoctira;
uniform vec3 uEquilara;
uniform int uEntityCount;
uniform vec3 uEntityDirs[MAX_GLOWS];
uniform vec3 uEntityColors[MAX_GLOWS];
uniform float uEntityStrength[MAX_GLOWS];
uniform vec3 uHoverDir;
uniform float uHoverActive;
uniform vec3 uRiverAColor;
uniform vec3 uRiverBColor;

varying vec3 vObjectNormal;
varying vec3 vViewDir;

float fbm(vec3 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * noise(p);
		p *= 2.1;
		a *= 0.5;
	}
	return v;
}

/**
 * Permukaan Zymtuary bukan planet biasa — tiada benua/lautan sebenar.
 * Tiga alam (Luminara cahaya, Noctira bayang, Equilara garisan penyatuan)
 * mengalir sebagai arus warna organik yang saling meresap di sempadan
 * (rujuk deskripsi Wandari: "dua lukisan cat air belum kering bertindih"),
 * bukan bentuk tanah/air yang terpisah tajam.
 */
vec3 mythicSurface(vec3 n, float detailBoost) {
	float lat = n.y;

	vec3 p = n * (2.1 + detailBoost * 0.9);
	vec3 warp = vec3(fbm(p + 4.1), fbm(p + 7.7), fbm(p + 1.3)) - 0.5;
	vec3 pw = p + warp * 1.7;

	float flowBroad = fbm(pw * 1.4);
	float flowFine = fbm(pw * 3.6 + 9.0);
	float veins = smoothstep(0.5, 0.86, flowFine * 0.6 + flowBroad * 0.4);

	float drift = (flowBroad - 0.5) * 0.55 + (flowFine - 0.5) * 0.2;
	float lumMask = smoothstep(-0.08, 0.62, lat + drift);
	float noctMask = smoothstep(-0.08, 0.62, -lat + drift);
	float overlap = lumMask * noctMask;

	vec3 col = uEquilara;
	col = mix(col, uLuminara, lumMask);
	col = mix(col, uNoctira, noctMask * (1.0 - lumMask * 0.6));
	col = mix(col, (uLuminara + uNoctira) * 0.5, overlap * 0.55);

	col *= 0.86 + veins * 0.34;
	col += veins * mix(uLuminara, uNoctira, step(0.0, -lat)) * 0.06;

	// Kekayaan tona berlapis (#5) — variasi dwi-warna halus supaya permukaan
	// tidak rata "murah": Luminara dapat lapisan amber-madu hangat, Noctira
	// lapisan nila sejuk, Equilara sedikit teal — mengikut fbm tona berasingan.
	float tone = fbm(pw * 2.3 + 5.0);
	col = mix(col, col * vec3(1.10, 1.03, 0.88), tone * 0.34 * lumMask);
	col = mix(col, col * vec3(0.9, 0.97, 1.06), (1.0 - tone) * 0.24 * noctMask);
	col = mix(col, col * vec3(0.92, 1.05, 1.02), tone * 0.2 * overlap);

	return col;
}

vec3 hazeLayer(vec3 n, float proximity, out float density) {
	float lat = n.y;
	vec3 drift = vec3(uTime * 0.03, uTime * 0.006, uTime * 0.024);
	float h1 = fbm(n * 3.2 + drift);
	float h2 = fbm(n * 6.0 + drift * 1.25 + vec3(2.0, 0.0, 1.0)) * 0.5;
	float h = h1 + h2;
	density = smoothstep(0.5, 0.74, h) * mix(0.05, 0.16, proximity);

	float lum = smoothstep(0.0, 0.6, lat);
	float noct = smoothstep(0.0, 0.6, -lat);
	vec3 hazeCol = uEquilara * 1.1;
	hazeCol = mix(hazeCol, uLuminara * 1.3, lum);
	hazeCol = mix(hazeCol, uNoctira * 1.15, noct);
	return hazeCol;
}

vec3 featureColor(float t, float lat) {
	float warm = step(0.0, lat);
	if (t < 1.5) return mix(vec3(0.09, 0.08, 0.11), vec3(0.22, 0.12, 0.08), warm); // gunung
	if (t < 2.5) return mix(vec3(0.02, 0.05, 0.1), vec3(0.16, 0.42, 0.38), warm); // air
	if (t < 3.5) return mix(vec3(0.08, 0.2, 0.13), vec3(0.42, 0.48, 0.16), warm); // hijau
	if (t < 4.5) return vec3(0.5, 0.42, 0.28); // padang pasir
	if (t < 5.5) return vec3(0.85, 0.42, 0.08); // teres air panas
	if (t < 6.5) return vec3(0.3, 0.42, 0.15); // pokok Heartbloom
	if (t < 7.5) {
		// Selat Equilara — aqua tersendiri, beralih lancar merentasi khatulistiwa
		// (bukan langkah tajam step() macam air biasa) sebab satu selat ini
		// sebenarnya merentasi Luminara-Equilara-Noctira dalam satu rantaian.
		float bridgeWarm = smoothstep(-0.2, 0.2, lat);
		return mix(vec3(0.08, 0.4, 0.56), vec3(0.16, 0.56, 0.5), bridgeWarm);
	}
	if (t < 8.5) return vec3(0.68, 0.56, 0.34); // Mendari — jalan batu pasir keemasan
	// Padang rumput (meadow) — hijau rumput CERAH tersendiri, kontras jelas
	// dgn 'hijau' generik kekabur-kuning (cth. hutan-senja).
	return mix(vec3(0.1, 0.28, 0.14), vec3(0.24, 0.6, 0.22), warm);
}

/** Mercu tanda liar (gunung/air/hijau/gurun/teres/pokok) — rekahan diasingkan
 * ke applyCracks() sebab bentuknya rangkaian bercabang, bukan tampalan
 * bulat. Air dipecah kepada beberapa lobus (bukan bulatan sempurna) supaya
 * kelihatan seperti garis pantai semula jadi. */
vec3 applyFeatures(vec3 col, vec3 n) {
	for (int i = 0; i < MAX_FEATURES; i++) {
		if (i >= uFeatureCount) break;
		vec3 dir = uFeatureDirs[i];
		float t = uFeatureType[i];
		float radius = uFeatureRadius[i];
		bool ringMode = uFeatureRingMode[i] > 0.5;
		float ringWidth = uFeatureRingWidth[i];

		float align = dot(n, dir);
		float outerReach = ringMode ? (radius + ringWidth * 2.0) : radius;
		if (align < cos(outerReach * 1.9)) continue;

		float edgeNoise = fbm2(n * 9.0 + dir * 3.0) - 0.5;
		float cosR = cos(radius * (1.0 + edgeNoise * 0.45));
		float epsilon = max(radius * 0.4, 0.03);
		float mask;
		// Jarak sudut relatif (0 = puncak/pusat, 1 = tepi) — dikongsi dgn
		// snow-cap/vein di bawah supaya kedudukannya ikut jejari SEBENAR
		// ciri ini (bukan nilai align mutlak, yg jadi salah bila radius kecil).
		float slopeT = 0.0;
		if (ringMode) {
			float angDist = acos(clamp(align, -1.0, 1.0));
			mask = 1.0 - smoothstep(0.0, ringWidth, abs(angDist - radius));
		} else {
			float angDist = acos(clamp(align, -1.0, 1.0));
			float effRadius = radius * (1.0 + edgeNoise * 0.45);
			slopeT = clamp(angDist / effRadius, 0.0, 1.0);
			float domeFalloff = 1.0 - smoothstep(0.0, 1.0, slopeT);
			mask = pow(domeFalloff, uFeaturePeakSharpness[i]);
		}
		mask *= raggedMultiplier(n, dir, radius, uFeatureRaggedness[i]);

		if (!ringMode && ((t > 1.5 && t < 2.5) || (t > 6.5 && t < 7.5))) {
			vec3 upRef = abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
			vec3 tu = normalize(cross(upRef, dir));
			vec3 tv = cross(dir, tu);
			float h1 = hash(dir * 13.7 + 3.1);
			float h2 = hash(dir * 27.3 + 7.7);
			vec3 lobeDir1 = normalize(dir + (tu * (h1 - 0.5) * 2.0 + tv * (fract(h1 * 13.0) - 0.5) * 2.0) * radius * 0.8);
			vec3 lobeDir2 = normalize(dir + (tu * (fract(h2 * 7.0) - 0.5) * 2.0 + tv * (h2 - 0.5) * 2.0) * radius * 0.8);
			float cosLobe = cos(radius * 0.65);
			float mask1 = smoothstep(cosLobe - epsilon, cosLobe + epsilon, dot(n, lobeDir1));
			float mask2 = smoothstep(cosLobe - epsilon, cosLobe + epsilon, dot(n, lobeDir2));
			mask = max(mask, max(mask1, mask2));
		}
		if (mask < 0.004) continue;

		vec3 fc = featureColor(t, n.y);

		if (t < 1.5) {
			// Badlands/gunung batu — ridge + rekahan tanah halus (garis gelap
			// tajam) supaya permukaan batu terasa retak, bukan rata licin.
			float ridge = 0.7 + 0.3 * fbm2(n * 12.0 + dir * 2.0);
			float groundCrack = smoothstep(0.78, 0.9, fbm2(n * 34.0 + dir * 9.0));
			col = mix(col, fc * ridge, mask * 0.8);
			col = mix(col, fc * 0.35, mask * groundCrack * 0.6);
			if (uFeatureSnowCap[i] > 0.5) {
				// slopeT (bukan align mutlak) — kekal betul walau berapa kecil
				// jejari puncak (align mutlak nyaris tak berubah utk puncak
				// tirus sempit, sebab tu dulu seluruh gunung jadi putih semua).
				float snow = 1.0 - smoothstep(0.22, 0.42, slopeT);
				vec3 snowColor = mix(vec3(0.72, 0.84, 0.95), vec3(0.96, 0.99, 1.0), fbm2(n * 25.0 + dir * 5.0));
				col = mix(col, snowColor, snow * mask);
			}
			if (uFeatureCrystalVein[i] > 0.5) {
				// Urat kristal ungu-biru berdenyar menuruni cerun dari puncak —
				// gema rujukan (gunung tirus dgn cahaya kristal mengalir turun).
				vec3 upRefV = abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
				vec3 tuV = normalize(cross(upRefV, dir));
				vec3 tvV = cross(dir, tuV);
				vec2 pV = vec2(dot(n, tuV), dot(n, tvV));
				vec2 veinDir = normalize(vec2(0.18, -1.0));
				float alongVein = dot(pV, veinDir);
				vec2 perpV = pV - veinDir * alongVein;
				float distFromVein = length(perpV);
				float jag = (fbm2(n * 22.0 + dir * 6.0) - 0.5) * radius * 0.18;
				float veinWidth = radius * 0.05;
				float veinLine = smoothstep(veinWidth + jag, veinWidth * 0.15 + jag, distFromVein);
				veinLine *= smoothstep(-radius * 0.06, 0.0, alongVein) * (1.0 - smoothstep(radius * 0.82, radius * 1.02, alongVein));
				float veinPulse = 0.75 + 0.25 * sin(uTime * 1.1 + alongVein * 18.0);
				vec3 veinColor = vec3(0.55, 0.4, 0.98);
				col = mix(col, veinColor, veinLine * mask * 0.75);
				col += veinColor * veinLine * mask * veinPulse * 0.6;
			}
		} else if (t < 2.5) {
			float sparkle = smoothstep(0.82, 0.97, fbm2(n * 20.0 + vec3(uTime * 0.15, 0.0, 0.0)));
			col = mix(col, fc, mask * 0.78);
			col += sparkle * mask * 0.06;

			// Jurang parit laut dalam (Thalyssan Depths) — khusus laut Noctira
			// sahaja (dir.y < 0), bukan Laut Keemasan di Luminara. Garis panjang
			// jelas merentasi lobus air secara pepenjuru (bukan tompok noise
			// kabur), tepi jengkel sedikit supaya organik, bukan garis lurus tepat.
			if (dir.y < 0.0) {
				vec3 upRefW = abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
				vec3 tuW = normalize(cross(upRefW, dir));
				vec3 tvW = cross(dir, tuW);
				// dir sentiasa unjur ke (0,0) dalam asas tangen ini (tuW/tvW
				// berserenjang dengan dir secara binaan) — jadi garis parit terus
				// bermula/berakhir relatif kepada pusat lobus tanpa ofset lagi.
				vec2 pW = vec2(dot(n, tuW), dot(n, tvW));
				vec2 laW = vec2(-radius * 0.85, -radius * 0.22);
				vec2 lbW = vec2(radius * 0.85, radius * 0.28);
				vec2 baW = lbW - laW;
				vec2 paW = pW - laW;
				float tSeg = clamp(dot(paW, baW) / max(dot(baW, baW), 1e-5), 0.0, 1.0);
				float distW = length(paW - baW * tSeg);
				float jag = (fbm2(n * 16.0 + dir * 6.0) - 0.5) * radius * 0.1;
				float trenchWidth = radius * 0.11;
				float trench = smoothstep(trenchWidth + jag, trenchWidth * 0.25 + jag, distW);
				col = mix(col, fc * 0.22, mask * trench * 0.75);
			}
		} else if (t < 3.5) {
			float speckle = smoothstep(0.7, 0.88, fbm2(n * 26.0 + dir * 6.0));
			col = mix(col, fc, mask * 0.78);
			col += speckle * mask * fc * 0.5;
		} else if (t < 4.5) {
			float groundCrack = smoothstep(0.76, 0.89, fbm2(n * 30.0 + dir * 8.0));
			col = mix(col, fc, mask * 0.75);
			col = mix(col, fc * 0.4, mask * groundCrack * 0.55);
		} else if (t < 5.5) {
			// Teres air panas ceria — kolam tosca terang berselang jalur
			// mineral jingga, dengan kilauan wap putih di tepi setiap terase.
			float rings = 0.5 + 0.5 * sin(acos(clamp(align, -1.0, 1.0)) * 34.0);
			vec3 poolColor = vec3(0.35, 0.72, 0.66);
			vec3 terraceColor = mix(poolColor, fc * 1.15, rings);
			float steam = smoothstep(0.4, 0.52, abs(sin(acos(clamp(align, -1.0, 1.0)) * 34.0)) ) * 0.3;
			col = mix(col, terraceColor, mask * 0.82);
			col += vec3(0.9, 0.95, 0.9) * steam * mask * 0.25;
		} else if (t < 6.5) {
			float core = smoothstep(cosR + epsilon * 0.6, 1.0, align);
			col = mix(col, fc, mask * 0.75);
			col += fc * core * 0.5;
		} else if (t < 7.5) {
			// Selat Equilara — kilauan air lembut sahaja, TANPA jurang Thalyssan
			// (jurang itu khusus Tasik Gelap, bukan selat penghubung ini).
			float sparkle = smoothstep(0.82, 0.97, fbm2(n * 20.0 + vec3(uTime * 0.15, 0.0, 0.0)));
			col = mix(col, fc, mask * 0.78);
			col += sparkle * mask * 0.06;
		} else if (t < 8.5) {
			// Mendari — speckle merah jambu (bougainvillea) berselang jalan emas.
			float speckle = smoothstep(0.74, 0.9, fbm2(n * 32.0 + dir * 7.0));
			col = mix(col, fc, mask * 0.8);
			col += speckle * mask * vec3(0.95, 0.55, 0.7) * 0.5;
		} else {
			// Padang rumput (meadow) — hijau rata dgn variasi tona halus
			// (helaian rumput), TANPA speckle warna lain (bunga sebenar
			// dilayan sbg objek 3D berasingan dlm TerrainProps.tsx).
			float bladeNoise = fbm2(n * 30.0 + dir * 8.0) - 0.5;
			col = mix(col, fc, mask * 0.82);
			col += bladeNoise * mask * 0.05;
		}
	}
	return col;
}

/** Retakan macam labah-labah — beberapa retakan merekah keluar dari pusat,
 * jengkel dan bercabang, tirus ke hujung. Warna & denyutan cahaya dikira
 * ikut hemisfera (jingga lava vs biru-putih ais). */
vec3 applyCracks(vec3 col, vec3 n) {
	if (!nearAnyCrackBound(n)) return col;

	float glow = 0.0;
	for (int i = 0; i < MAX_CRACK_SEGMENTS; i++) {
		float w = uCrackWidth[i];
		if (w < 0.0001) continue;
		float d = distToSegment(n, uCrackA[i], uCrackB[i]);
		glow = max(glow, smoothstep(w * 1.6, w * 0.2, d));
	}
	if (glow < 0.003) return col;

	vec3 crackColor = mix(vec3(0.6, 0.92, 1.0), vec3(1.0, 0.45, 0.08), step(0.0, n.y));
	float pulse = 0.75 + 0.25 * sin(uTime * 1.3 + n.x * 8.0 + n.z * 6.0);
	col = mix(col, crackColor, glow * 0.4);
	col += crackColor * glow * pulse * 1.5;
	return col;
}

float riverMask(vec3 n, vec3 segA[MAX_RIVER_SEGMENTS], vec3 segB[MAX_RIVER_SEGMENTS], float widths[MAX_RIVER_SEGMENTS]) {
	float m = 0.0;
	for (int i = 0; i < MAX_RIVER_SEGMENTS; i++) {
		float w = widths[i];
		if (w < 0.0001) continue;
		float d = distToSegment(n, segA[i], segB[i]);
		m = max(m, smoothstep(w * 1.3, w * 0.25, d));
	}
	return m;
}

/** Sungai tirus & bercabang (bukan garis lurus lebar seragam) — lihat
 * generateRiverNetwork dalam worldGlobeConfig.ts untuk penjanaan bentuk. */
vec3 applyRivers(vec3 col, vec3 n) {
	if (dot(n, uRiverABoundDir) > cos(uRiverABoundRadius)) {
		col = mix(col, uRiverAColor, riverMask(n, uRiverASegA, uRiverASegB, uRiverAWidth) * 0.85);
	}
	if (dot(n, uRiverBBoundDir) > cos(uRiverBBoundRadius)) {
		col = mix(col, uRiverBColor, riverMask(n, uRiverBSegA, uRiverBSegB, uRiverBWidth) * 0.85);
	}
	return col;
}

vec3 innerResonance(vec3 n, float frontMask) {
	vec3 glow = vec3(0.0);
	for (int i = 0; i < MAX_GLOWS; i++) {
		if (i >= uEntityCount) break;
		float align = dot(n, uEntityDirs[i]);
		float core = smoothstep(0.988, 0.9998, align);
		float bleed = smoothstep(0.972, 0.988, align) * 0.18;
		float pulse = 0.82 + 0.18 * sin(uTime * 0.75 + float(i) * 1.1);
		float w = (core * 1.4 + bleed) * uEntityStrength[i] * pulse;
		glow += uEntityColors[i] * w;
	}

	float hoverAlign = dot(n, normalize(uHoverDir));
	float hoverBoost = smoothstep(0.975, 0.999, hoverAlign) * uHoverActive * 0.5;
	glow += uEquilara * hoverBoost;

	return glow * frontMask;
}

void main() {
	// vObjectNormal sudah terganggu (bump) ikut relief 3D dalam vertex
	// shader — beri rupa bonjolan/lekukan sebenar pada pencahayaan tanpa
	// bergantung pada terbitan skrin yang rapuh (dFdx/dFdy pernah
	// menghasilkan permukaan hitam besar berbentuk poligon di sini).
	vec3 n = normalize(vObjectNormal);

	float frontMask = smoothstep(0.08, 0.35, dot(n, normalize(vViewDir)));
	float detailBoost = uProximity;

	vec3 col = mythicSurface(n, detailBoost);
	col = applyFeatures(col, n);
	col = applyCracks(col, n);
	col = applyRivers(col, n);

	vec3 lightDir = normalize(vec3(0.35, 0.55, 0.75));
	float litSide = max(dot(n, lightDir), 0.0); // 0 = sisi bayang, 1 = sisi cahaya
	float diffuse = 0.5 + 0.5 * litSide;
	col *= diffuse;
	col *= 1.08 + detailBoost * 0.18;

	// Fill sejuk pada sisi bayang (#3) — angkat sedikit dgn nila-teal supaya
	// sisi Noctira/bayang TIDAK jatuh hitam pekat & hilang ditelan nebula;
	// planet kekal terbaca sbg sfera penuh. Halus, hanya di sisi tak bermandi
	// cahaya.
	float shadowSide = 1.0 - litSide;
	col += vec3(0.10, 0.14, 0.22) * shadowSide * 0.14;

	vec3 resonance = innerResonance(n, frontMask);
	col += resonance * mix(0.32, 0.18, uProximity);

	float hazeDensity;
	vec3 haze = hazeLayer(n, uProximity, hazeDensity);
	col = mix(col, haze, hazeDensity);

	float breathe = 0.94 + 0.03 * sin(uTime * 0.7);
	col *= breathe;

	// Rim atmosfera berarah (#1) — halo cahaya di limbah planet: EMAS hangat di
	// sisi bermandi cahaya, TEAL-NILA sejuk di sisi bayang. Ini memisahkan
	// siluet planet drpd latar nebula DAN mengikatnya (rim sejuk berima dgn
	// nebula sejuk) — teknik teras studio angkasa. Lebih kuat drpd fresnel
	// lembut dahulu.
	float rim = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), 3.0);
	vec3 rimWarm = vec3(1.0, 0.76, 0.4);
	vec3 rimCool = vec3(0.32, 0.62, 0.82);
	vec3 rimCol = mix(rimCool, rimWarm, litSide);
	col += rim * rimCol * mix(0.35, 0.55, uProximity) * frontMask;

	// Kilau tepi halus tambahan (kekal, lembut) supaya limbah tidak keras.
	float fresnel = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), 2.4);
	col += fresnel * vec3(0.10, 0.11, 0.13) * frontMask;

	gl_FragColor = vec4(col, 1.0);
}
`;

export function createGlobeMaterial(entityUniforms?: EntityGlowUniforms): THREE.ShaderMaterial {
	const glow = entityUniforms ?? createEntityGlowUniforms();

	const { dirs, types, radii, heightScales, ringModes, ringWidths, peakSharpnesses, snowCaps, crystalVeins, raggednesses, count } =
		buildFeatureUniformArrays();
	const featureDirs = Array.from({ length: MAX_FEATURES }, (_, i) =>
		dirs[i] ? new THREE.Vector3(...dirs[i]) : new THREE.Vector3(0, 1, 0),
	);
	const featureTypes = Array.from({ length: MAX_FEATURES }, (_, i) => types[i] ?? 0);
	const featureRadii = Array.from({ length: MAX_FEATURES }, (_, i) => radii[i] ?? 0.1);
	const featureHeightScales = Array.from({ length: MAX_FEATURES }, (_, i) => heightScales[i] ?? 1);
	const featureRingModes = Array.from({ length: MAX_FEATURES }, (_, i) => ringModes[i] ?? 0);
	const featureRingWidths = Array.from({ length: MAX_FEATURES }, (_, i) => ringWidths[i] ?? 0.05);
	const featurePeakSharpnesses = Array.from({ length: MAX_FEATURES }, (_, i) => peakSharpnesses[i] ?? 1);
	const featureSnowCaps = Array.from({ length: MAX_FEATURES }, (_, i) => snowCaps[i] ?? 0);
	const featureCrystalVeins = Array.from({ length: MAX_FEATURES }, (_, i) => crystalVeins[i] ?? 0);
	const featureRaggednesses = Array.from({ length: MAX_FEATURES }, (_, i) => raggednesses[i] ?? 0);

	const cracks = buildCrackUniformArrays();
	const crackA = Array.from({ length: MAX_CRACK_SEGMENTS }, (_, i) => new THREE.Vector3(...cracks.a[i]));
	const crackB = Array.from({ length: MAX_CRACK_SEGMENTS }, (_, i) => new THREE.Vector3(...cracks.b[i]));
	const crackWidth = Array.from({ length: MAX_CRACK_SEGMENTS }, (_, i) => cracks.width[i]);
	const crackBoundDirs = Array.from({ length: 2 }, (_, i) => new THREE.Vector3(...(cracks.boundDirs[i] ?? [0, 1, 0])));
	const crackBoundRadius = Array.from({ length: 2 }, (_, i) => cracks.boundRadius[i] ?? 0);

	const rivers = buildRiverUniformArrays();
	const riverSegA = (river?: (typeof rivers)[number]) =>
		Array.from({ length: MAX_RIVER_SEGMENTS }, (_, i) => new THREE.Vector3(...(river?.a[i] ?? [0, 1, 0])));
	const riverSegB = (river?: (typeof rivers)[number]) =>
		Array.from({ length: MAX_RIVER_SEGMENTS }, (_, i) => new THREE.Vector3(...(river?.b[i] ?? [0, 1, 0])));
	const riverWidth = (river?: (typeof rivers)[number]) =>
		Array.from({ length: MAX_RIVER_SEGMENTS }, (_, i) => river?.width[i] ?? 0);

	const material = new THREE.ShaderMaterial({
		vertexShader: globeVertexShader,
		fragmentShader: globeFragmentShader,
		uniforms: {
			uTime: { value: 0 },
			uProximity: { value: 0 },
			uLuminara: { value: hexToVec3(HEMISPHERE_COLORS.luminara) },
			uNoctira: { value: hexToVec3(HEMISPHERE_COLORS.noctira) },
			uEquilara: { value: hexToVec3(HEMISPHERE_COLORS.equilara) },
			uFeatureCount: { value: count },
			uFeatureDirs: { value: featureDirs },
			uFeatureType: { value: featureTypes },
			uFeatureRadius: { value: featureRadii },
			uFeatureHeightScale: { value: featureHeightScales },
			uFeatureRingMode: { value: featureRingModes },
			uFeatureRingWidth: { value: featureRingWidths },
			uFeaturePeakSharpness: { value: featurePeakSharpnesses },
			uFeatureSnowCap: { value: featureSnowCaps },
			uFeatureCrystalVein: { value: featureCrystalVeins },
			uFeatureRaggedness: { value: featureRaggednesses },
			uCrackA: { value: crackA },
			uCrackB: { value: crackB },
			uCrackWidth: { value: crackWidth },
			uCrackBoundDirs: { value: crackBoundDirs },
			uCrackBoundRadius: { value: crackBoundRadius },
			uRiverASegA: { value: riverSegA(rivers[0]) },
			uRiverASegB: { value: riverSegB(rivers[0]) },
			uRiverAWidth: { value: riverWidth(rivers[0]) },
			uRiverBSegA: { value: riverSegA(rivers[1]) },
			uRiverBSegB: { value: riverSegB(rivers[1]) },
			uRiverBWidth: { value: riverWidth(rivers[1]) },
			uRiverAColor: { value: hexToVec3(rivers[0]?.color ?? '#5ba3a0') },
			uRiverBColor: { value: hexToVec3(rivers[1]?.color ?? '#4a5568') },
			uRiverABoundDir: { value: new THREE.Vector3(...(rivers[0]?.boundDir ?? [0, 1, 0])) },
			uRiverABoundRadius: { value: rivers[0]?.boundRadius ?? 0 },
			uRiverBBoundDir: { value: new THREE.Vector3(...(rivers[1]?.boundDir ?? [0, 1, 0])) },
			uRiverBBoundRadius: { value: rivers[1]?.boundRadius ?? 0 },
			...glow,
		},
	});
	return material;
}

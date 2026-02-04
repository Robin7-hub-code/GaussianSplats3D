# Shadow Mapping for 3D Gaussian Splats

This document describes the directional shadow mapping feature that allows meshes in the Three.js scene to cast shadows onto Gaussian splats.

## Overview

The shadow mapping implementation uses WebGL2 features to render shadows cast by meshes onto splats. It supports both standard PCF (Percentage-Closer Filtering) and PCSS (Percentage-Closer Soft Shadows) for soft shadow edges.

## Requirements

- **WebGL2 Support**: Shadow mapping requires WebGL2. The viewer will automatically detect support and gracefully disable shadows if WebGL2 is not available.
- The feature is disabled by default to maintain backward compatibility.

## Usage

### Basic Setup

To enable shadow mapping, pass the appropriate options when creating a `Viewer` instance:

```javascript
const viewer = new GaussianSplats3D.Viewer({
    'enableShadowsOnSplats': true,  // Enable shadow mapping
    'threeScene': myThreeScene,      // Must have meshes to cast shadows
    // ... other options
});
```

### Configuration Options

The following options control shadow mapping behavior:

#### `enableShadowsOnSplats` (boolean, default: `false`)
Enable or disable shadow mapping on splats. When `false`, no shadow processing occurs.

#### `enablePCSSOnSplats` (boolean, default: `false`)
Enable PCSS (Percentage-Closer Soft Shadows) for softer, more realistic shadow edges. When `false`, uses standard PCF filtering.

#### `shadowMapResolution` (number, default: `1024`)
Resolution of the shadow map texture. Higher values improve shadow quality but reduce performance.
- Recommended: `1024` or `2048`
- Range: `512` to `4096`

#### `shadowBias` (number, default: `0.001`)
Depth bias to prevent shadow acne (self-shadowing artifacts). Adjust if you see:
- **Shadow acne**: Reduce the value (e.g., `0.0005`)
- **Peter Panning** (shadows detaching from objects): Increase the value (e.g., `0.002`)

#### `shadowLightDirection` (Array<number>, default: `[0.5, -1.0, 0.5]`)
Direction vector `[x, y, z]` for the directional light. The vector will be automatically normalized.
- Example: `[0, -1, 0]` - light from directly above
- Example: `[1, -1, 0]` - light from upper-right

#### `shadowOrthoSize` (number, default: `10`)
Size of the orthographic shadow camera frustum in world units. Affects the shadow coverage area.
- Increase for larger scenes
- Decrease for tighter, higher-quality shadows on smaller areas

#### `shadowNearFar` (Array<number>, default: `[0.1, 50]`)
Near and far clip planes `[near, far]` for the shadow camera. Objects outside this range won't cast shadows.

#### `shadowLightRadius` (number, default: `0.01`)
Area light radius in world units, used for PCSS penumbra calculation. Only affects shadows when `enablePCSSOnSplats` is true.
- Smaller values: Sharper shadows
- Larger values: Softer, more spread-out shadows

### Example: Full Configuration

```javascript
const viewer = new GaussianSplats3D.Viewer({
    'threeScene': threeScene,
    'enableShadowsOnSplats': true,
    'enablePCSSOnSplats': false,
    'shadowMapResolution': 2048,
    'shadowBias': 0.0008,
    'shadowLightDirection': [0.5, -1.0, 0.5],
    'shadowOrthoSize': 15,
    'shadowNearFar': [1, 100],
    'shadowLightRadius': 0.015
});
```

## How It Works

The shadow mapping system operates in several stages:

1. **Shadow Camera Setup**: An orthographic camera is positioned based on the light direction, looking at the scene center.

2. **Depth Pass**: Each frame, meshes in `threeScene` (excluding the splat mesh) are rendered from the light's point of view into a shadow map texture.

3. **Shadow Sampling**: During splat rendering, each splat's world position is transformed into light space. The fragment shader samples the shadow map to determine if the splat is in shadow.

4. **Shadow Application**: Shadowed splats are darkened by multiplying their color by a shadow factor (0.3 = 70% darkening).

## PCF vs PCSS

### PCF (Percentage-Closer Filtering)
- **Performance**: Fast
- **Quality**: Good, with soft edges using a 3×3 filter kernel
- **Use case**: Default option for most scenes

### PCSS (Percentage-Closer Soft Shadows)
- **Performance**: Slower (requires blocker search and adaptive filtering)
- **Quality**: Excellent, with realistic penumbra (shadow softness varies with distance)
- **Use case**: High-quality rendering where performance is less critical

## Performance Considerations

Shadow mapping adds overhead to the rendering pipeline:

1. **Shadow Depth Pass**: Renders the entire `threeScene` to generate the shadow map
2. **Shader Complexity**: Adds texture lookups and calculations to splat fragment shaders
3. **Memory**: Allocates a render target (e.g., 1024×1024 × 4 bytes × 2 = 8MB for RGBA float)

**Tips for optimal performance**:
- Keep `shadowMapResolution` at 1024 or lower for real-time applications
- Use PCF instead of PCSS for better frame rates
- Minimize the number of meshes in `threeScene` that need to cast shadows

## Troubleshooting

### Shadows not appearing
- Ensure WebGL2 is supported (check browser console for warnings)
- Verify `enableShadowsOnSplats` is set to `true`
- Confirm `threeScene` contains visible mesh objects
- Check that the light direction and camera position allow shadows to be visible

### Shadow artifacts (acne or banding)
- Adjust `shadowBias` (try values between `0.0005` and `0.005`)
- Increase `shadowMapResolution` for finer detail
- Ensure shadow near/far planes encompass your scene

### Shadows detached from objects (Peter Panning)
- Reduce `shadowBias` value
- Check that `shadowOrthoSize` is appropriate for your scene scale

### Poor performance
- Reduce `shadowMapResolution` (try `512` or `1024`)
- Disable PCSS and use PCF instead
- Simplify the `threeScene` mesh geometry

## Implementation Details

### File Structure
- `src/shadows/ShadowUtils.js`: Utility functions for shadow map creation and rendering
- `src/shadows/ShadowShaders.js`: GLSL shader code for PCF and PCSS
- `src/Viewer.js`: Integration and uniform management
- `src/splatmesh/SplatMaterial2D.js`: 2D splat material with shadow support
- `src/splatmesh/SplatMaterial3D.js`: 3D splat material with shadow support

### Shader Integration
Shadow coordinates are calculated in the vertex shader:
```glsl
vec4 worldPos = modelMatrix * vec4(splatCenter, 1.0);
vShadowCoord = shadowMatrixWorldToLight * worldPos;
```

Shadow sampling occurs in the fragment shader:
```glsl
if (enableShadows == 1) {
    float shadowFactor = getPCFShadow(...);  // or getPCSSShadow(...)
    color = color * mix(0.3, 1.0, shadowFactor);
}
```

## Future Enhancements

Potential improvements for the shadow mapping system:
- Support for multiple shadow-casting lights
- Cascaded shadow maps for better quality across large scenes
- Splats casting shadows onto meshes (splat→mesh)
- Auto-fitting shadow frustum based on camera view
- Shadow map caching when scene is static

## See Also

- Demo: `demo/shadows_test.html`
- [Three.js Shadow Mapping Documentation](https://threejs.org/docs/#api/en/lights/shadows/LightShadow)
- [PCF Shadow Mapping](https://developer.nvidia.com/gpugems/gpugems/part-ii-lighting-and-shadows/chapter-11-shadow-map-antialiasing)
- [PCSS (Percentage-Closer Soft Shadows)](https://developer.download.nvidia.com/shaderlibrary/docs/shadow_PCSS.pdf)

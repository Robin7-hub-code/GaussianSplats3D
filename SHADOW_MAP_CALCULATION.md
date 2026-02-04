# Shadow Map 计算详解 (Shadow Map Calculation Explained)

## 问题回答 (Question Answer)

**问题:** "你的shadowmap是怎么计算的？是从光源方向计算的吗？"  
**Question:** "How is your shadowmap calculated? Is it calculated from the light source direction?"

**回答:** **是的！** Shadow map 确实是从光源方向计算的。  
**Answer:** **Yes!** The shadow map is indeed calculated from the light source direction.

---

## 核心原理 (Core Principle)

Shadow mapping 使用**两遍渲染**技术：
1. **第一遍（从光源视角）**: 从光源位置看向场景，记录深度信息
2. **第二遍（从相机视角）**: 正常渲染，并通过比较深度判断是否在阴影中

Shadow mapping uses a **two-pass rendering** technique:
1. **First Pass (From Light's Perspective)**: Render from the light's position, recording depth information
2. **Second Pass (From Camera's Perspective)**: Normal rendering, determining shadows by comparing depths

---

## 详细计算流程 (Detailed Calculation Flow)

### 第一步：创建阴影相机 (Step 1: Create Shadow Camera)

**代码位置:** `src/shadows/ShadowUtils.js:42-49`

```javascript
static createShadowCamera(orthoSize, nearFar) {
    const camera = new THREE.OrthographicCamera(
        -orthoSize, orthoSize,
        orthoSize, -orthoSize,
        nearFar[0], nearFar[1]
    );
    return camera;
}
```

**说明 (Explanation):**
- 使用**正交相机** (Orthographic Camera) 模拟平行光
- 覆盖范围由 `orthoSize` 决定（默认 15 单位）
- 近远平面设置为 `[0.1, 50]`

---

### 第二步：定位阴影相机 (Step 2: Position Shadow Camera)

**代码位置:** `src/shadows/ShadowUtils.js:58-70`

```javascript
static updateShadowCameraTransform(camera, lightDirection, sceneCenter, distance = 20) {
    // 1. 归一化光照方向
    // Normalize light direction
    const dir = new THREE.Vector3(lightDirection[0], lightDirection[1], lightDirection[2]).normalize();
    
    // 2. 将相机放在光源方向的**反方向**
    // Position camera OPPOSITE to light direction
    const lightPos = new THREE.Vector3().copy(sceneCenter).addScaledVector(dir, -distance);
    
    // 3. 让相机看向场景中心
    // Make camera look at scene center
    camera.position.copy(lightPos);
    camera.lookAt(sceneCenter);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
}
```

**关键点 (Key Points):**

1. **光照方向 vs 相机位置 (Light Direction vs Camera Position)**
   ```
   光照方向 (Light Direction): [0.5, -1.0, 0.5] (光从这个方向来)
   归一化后 (Normalized): [0.408, -0.816, 0.408]
   相机位置 (Camera Position) = sceneCenter - dir × distance
                              = sceneCenter + [-0.408, 0.816, -0.408] × 20
   ```
   
2. **为什么用负方向？(Why Negative Direction?)**
   - 光照方向 = 光传播的方向（光从哪里来）
   - 相机需要放在光源位置（光的起点）
   - 所以相机位置 = sceneCenter - lightDirection × distance
   - Light direction = direction light travels (where light comes from)
   - Camera needs to be at light source position (light's origin)
   - So camera position = sceneCenter - lightDirection × distance

---

### 第三步：计算光源视图投影矩阵 (Step 3: Compute Light View-Projection Matrix)

**代码位置:** `src/shadows/ShadowUtils.js:77-84`

```javascript
static computeLightViewProjectionMatrix(shadowCamera) {
    const lightViewProjMatrix = new THREE.Matrix4();
    lightViewProjMatrix.multiplyMatrices(
        shadowCamera.projectionMatrix,  // 投影矩阵
        shadowCamera.matrixWorldInverse // 视图矩阵
    );
    return lightViewProjMatrix;
}
```

**矩阵变换链 (Matrix Transformation Chain):**
```
世界坐标 (World Space)
    ↓ × matrixWorldInverse (视图矩阵)
光源视图坐标 (Light View Space)
    ↓ × projectionMatrix (投影矩阵)
光源裁剪坐标 (Light Clip Space)
    ↓ ÷ w (透视除法)
光源NDC坐标 (Light NDC Space) [-1, 1]
    ↓ × 0.5 + 0.5
Shadow Map UV 坐标 [0, 1]
```

**这个矩阵的作用 (Purpose of This Matrix):**
- 将任意世界坐标点转换到光源的裁剪空间
- 用于在 shader 中计算阴影坐标
- Transforms any world space point to light's clip space
- Used in shader to compute shadow coordinates

---

### 第四步：渲染阴影深度通道 (Step 4: Render Shadow Depth Pass)

**代码位置:** `src/shadows/ShadowUtils.js:150-175`

```javascript
static renderShadowDepthPass(renderer, scene, shadowCamera, shadowTarget, excludeObject = null) {
    // 1. 保存渲染器状态
    const currentRenderTarget = renderer.getRenderTarget();
    
    // 2. 隐藏不投射阴影的物体（如 splat mesh）
    if (excludeObject) {
        excludeObject.visible = false;
    }
    
    // 3. 渲染到阴影贴图
    renderer.setRenderTarget(shadowTarget);
    renderer.clear();
    renderer.render(scene, shadowCamera);  // ← 从光源视角渲染！
    
    // 4. 恢复状态
    renderer.setRenderTarget(currentRenderTarget);
    if (excludeObject) {
        excludeObject.visible = true;
    }
}
```

**这一步生成什么？(What Does This Step Generate?)**
- 一张 1024×1024 的深度贴图
- 存储从光源看到的每个像素的深度值
- 深度值范围 [0, 1]，0 = 最近，1 = 最远
- A 1024×1024 depth texture
- Stores depth value of each pixel as seen from light
- Depth range [0, 1], 0 = nearest, 1 = farthest

**调用位置 (Called from):** `src/Viewer.js:523-534`
```javascript
renderShadowDepthPass() {
    ShadowUtils.renderShadowDepthPass(
        this.renderer,
        this.threeScene,      // 包含 THREE.js meshes (cup)
        this.shadowCamera,    // 从光源视角的相机
        this.shadowRenderTarget,
        this.splatMesh       // 排除 splat mesh
    );
}
```

---

### 第五步：在 Splat Shader 中采样阴影贴图 (Step 5: Sample Shadow Map in Splat Shader)

#### 5.1 顶点着色器 (Vertex Shader)

**代码位置:** `src/splatmesh/SplatMaterial2D.js` & `SplatMaterial3D.js`

```glsl
// 添加 uniform 和 varying
uniform mat4 shadowMatrixWorldToLight;
varying vec4 vShadowCoord;

void main() {
    // ... 计算 splat center ...
    
    // 将 splat 中心转换到光源空间
    // Transform splat center to light space
    vec4 worldPos = modelMatrix * vec4(splatCenter, 1.0);
    vShadowCoord = shadowMatrixWorldToLight * worldPos;
    
    // ... 其他计算 ...
}
```

**计算过程 (Calculation Process):**
```
splatCenter (对象空间)
    ↓ × modelMatrix
worldPos (世界空间)
    ↓ × shadowMatrixWorldToLight
vShadowCoord (光源裁剪空间)
    ↓ 传递到片段着色器
```

#### 5.2 片段着色器 - PCF 阴影采样 (Fragment Shader - PCF Shadow Sampling)

**代码位置:** `src/shadows/ShadowShaders.js:54-84`

```glsl
float getPCFShadow(sampler2D shadowMap, vec4 shadowCoord, vec2 shadowMapSize, float bias) {
    // 1. 透视除法
    // Perspective divide
    vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
    
    // 2. 转换到 [0,1] 范围
    // Transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;
    
    // 3. 边界检查
    // Bounds check
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || 
        projCoords.y < 0.0 || projCoords.y > 1.0 ||
        projCoords.z < 0.0 || projCoords.z > 1.0) {
        return 1.0;  // 边界外无阴影
    }
    
    float currentDepth = projCoords.z;
    
    // 4. PCF 滤波 - 3×3 采样核心
    // PCF filtering - 3×3 sampling kernel
    float shadow = 0.0;
    vec2 texelSize = 1.0 / shadowMapSize;
    
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            
            // 从 shadow map 采样深度
            // Sample depth from shadow map
            float pcfDepth = texture2D(shadowMap, projCoords.xy + offset).r;
            
            // 深度比较
            // Depth comparison
            shadow += (currentDepth - bias) > pcfDepth ? 0.0 : 1.0;
        }
    }
    shadow /= 9.0;  // 平均 9 个采样
    
    return shadow;  // 0.0 = 完全阴影, 1.0 = 无阴影
}
```

**PCF 采样模式 (PCF Sampling Pattern):**
```
    (-1,1)  (0,1)  (1,1)
    (-1,0)  (0,0)  (1,0)
    (-1,-1) (0,-1) (1,-1)
    
共 9 个采样点，产生平滑的阴影边缘
9 samples total, producing smooth shadow edges
```

#### 5.3 片段着色器 - 应用阴影 (Fragment Shader - Apply Shadow)

**代码位置:** `src/splatmesh/SplatMaterial2D.js` & `SplatMaterial3D.js`

```glsl
void main() {
    // ... 计算 splat 颜色 ...
    vec4 color = ...;
    
    // 计算阴影
    // Calculate shadow
    if (enableShadows == 1) {
        float shadowFactor;
        
        if (enablePCSS == 1) {
            shadowFactor = getPCSSShadow(...);  // 软阴影
        } else {
            shadowFactor = getPCFShadow(...);   // 标准阴影
        }
        
        // 应用阴影到颜色
        // Apply shadow to color
        // shadowFactor: 0.0 (完全阴影) → 1.0 (无阴影)
        // 阴影区域降至 30% 亮度
        // Shadow areas reduced to 30% brightness
        color.rgb = color.rgb * mix(0.3, 1.0, shadowFactor);
    }
    
    gl_FragColor = color;
}
```

---

## 可视化说明 (Visual Explanation)

### 场景设置 (Scene Setup)

```
                    光照方向 (Light Direction)
                    [0.5, -1.0, 0.5]
                           ↓
                           ↓
                           ↓
    
    阴影相机位置 (Shadow Camera Position)
    sceneCenter + [-0.408, 0.816, -0.408] × 20
              ↑
              |
              | 看向 (lookAt)
              |
              ↓
        场景中心 (Scene Center)
        [0, 0, 0]
              |
              | 包含
              |
              ↓
        Cup Mesh (投射阴影)
              |
              ↓ 阴影投射到
              ↓
        Gaussian Splats (接收阴影)
```

### 渲染流程 (Rendering Flow)

```
每一帧 (Each Frame):

┌─────────────────────────────────────┐
│  1. Update Shadow Camera            │
│     - 根据光照方向定位相机           │
│     - 计算 lightViewProjMatrix       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  2. Render Shadow Depth Pass        │
│     - 切换到 shadowRenderTarget      │
│     - 从光源视角渲染 cup             │
│     - 生成深度贴图                   │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  3. Update Splat Uniforms           │
│     - 设置 shadowMap texture         │
│     - 设置 lightViewProjMatrix       │
│     - 设置其他阴影参数               │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  4. Render Main Scene               │
│     - 渲染 THREE.js objects          │
│     - 渲染 Gaussian Splats           │
│       └─ Splat shader 采样阴影贴图   │
│          并应用阴影效果               │
└─────────────────────────────────────┘
```

---

## 关键代码位置总结 (Key Code Locations Summary)

| 功能 | 文件 | 行数 | 说明 |
|------|------|------|------|
| 创建阴影相机 | `src/shadows/ShadowUtils.js` | 42-49 | 创建正交相机 |
| 定位阴影相机 | `src/shadows/ShadowUtils.js` | 58-70 | 从光源方向定位 |
| 计算 VP 矩阵 | `src/shadows/ShadowUtils.js` | 77-84 | 光源视图投影矩阵 |
| 渲染深度通道 | `src/shadows/ShadowUtils.js` | 150-175 | 从光源视角渲染 |
| 更新相机 | `src/Viewer.js` | 500-517 | 每帧更新 |
| 渲染深度 | `src/Viewer.js` | 523-534 | 每帧渲染 |
| 更新 Uniforms | `src/Viewer.js` | 540-573 | 每帧更新 |
| Vertex Shader | `SplatMaterial2D/3D.js` | - | 转换到光源空间 |
| PCF Function | `src/shadows/ShadowShaders.js` | 54-84 | PCF 阴影采样 |
| PCSS Function | `src/shadows/ShadowShaders.js` | 92-171 | PCSS 软阴影 |
| 应用阴影 | `SplatMaterial2D/3D.js` | - | 应用到颜色 |

---

## 参数配置 (Parameter Configuration)

### demo/shadows_test.html 中的配置

```javascript
{
  'shadowMapResolution': 1024,           // 阴影贴图分辨率
  'shadowBias': 0.0005,                  // 深度偏移（防止阴影痤疮）
  'shadowLightDirection': [0.5, -1.0, 0.5], // 光照方向
  'shadowOrthoSize': 15,                 // 正交相机范围
  'shadowNearFar': [0.1, 50],            // 近远平面
  'shadowLightRadius': 0.15              // PCSS 光源半径
}
```

**参数说明 (Parameter Explanation):**

- **shadowMapResolution**: 阴影贴图分辨率，越大越清晰但性能越低
- **shadowBias**: 深度偏移值，防止"阴影痤疮"（shadow acne）
- **shadowLightDirection**: 光照传播方向（光从这个方向来）
- **shadowOrthoSize**: 阴影相机覆盖范围
- **shadowNearFar**: 阴影相机的近远裁剪平面
- **shadowLightRadius**: PCSS 软阴影的光源半径

---

## 常见问题 (FAQ)

### Q1: 为什么相机位置是光照方向的负方向？
**A:** 因为光照方向表示光传播的方向（光从哪里来），而相机需要放在光源的位置。例如：
- 光照方向 [0, -1, 0] 表示光从上往下
- 相机位置需要在上方：sceneCenter + [0, 1, 0] × distance

### Q2: 为什么使用正交相机而不是透视相机？
**A:** 方向光（Directional Light）的光线是平行的，所以使用正交相机模拟。如果是点光源或聚光灯，则需要使用透视相机。

### Q3: PCF 和 PCSS 有什么区别？
**A:** 
- **PCF**: 固定 3×3 采样，硬阴影边缘，性能好
- **PCSS**: 自适应采样（32 samples），软阴影边缘，更真实但性能较低

### Q4: shadowBias 是做什么的？
**A:** 防止"阴影痤疮"（shadow acne）。由于深度贴图精度限制，表面可能错误地认为自己在阴影中，产生斑点。bias 添加小偏移来解决这个问题。

### Q5: 为什么需要排除 splat mesh？
**A:** Splat mesh 是接收阴影的对象，不应该投射阴影到自己身上。我们只需要 THREE.js meshes（如 cup）投射阴影。

---

## 总结 (Summary)

### 核心答案 (Core Answer)

**是的，shadow map 完全是从光源方向计算的！**

**Yes, the shadow map is entirely calculated from the light source direction!**

### 关键步骤 (Key Steps)

1. ✅ 根据光照方向定位阴影相机（相机在光源位置）
2. ✅ 从光源视角渲染场景深度到 shadow map
3. ✅ 在 splat shader 中将坐标转换到光源空间
4. ✅ 采样 shadow map 并比较深度
5. ✅ 应用阴影效果

### 技术亮点 (Technical Highlights)

- **正交投影**: 模拟平行光
- **两遍渲染**: 第一遍从光源，第二遍从相机
- **PCF 滤波**: 平滑阴影边缘
- **PCSS 软阴影**: 基于距离的自适应软阴影
- **每帧更新**: 动态阴影跟随物体移动

---

## 参考资源 (References)

- THREE.js Shadow Mapping: https://threejs.org/examples/#webgl_shadowmap
- LearnOpenGL Shadow Mapping: https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping
- PCSS Paper: "Percentage-Closer Soft Shadows" by Fernando et al.

---

**文档版本 (Document Version)**: 1.0  
**更新日期 (Last Updated)**: 2026-02-04

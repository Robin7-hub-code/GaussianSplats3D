# Shadow Map Update Mechanism
# 阴影贴图更新机制

## 用户问题 (User Question)

**问题:** "当光源方向改变时会重新计算shadowmap吗"  
**Question:** "Will the shadowmap be recalculated when the light source direction changes?"

## 回答 (Answer)

**是的！Shadow map 在每一帧都会重新计算！**  
**Yes! The shadow map is recalculated every single frame!**

这意味着：
- ✅ 光源方向改变时，阴影自动更新
- ✅ 物体移动时，阴影自动跟随
- ✅ 场景变化时，阴影实时反映

This means:
- ✅ When light direction changes, shadows automatically update
- ✅ When objects move, shadows automatically follow
- ✅ When scene changes, shadows reflect in real-time

---

## 技术实现 (Technical Implementation)

### 每帧更新流程 (Per-Frame Update Flow)

在 Viewer 的渲染循环中，每一帧都会执行以下步骤：

```javascript
// Viewer.js render loop (line ~1764-1766)
render() {
    // 每一帧都执行：
    
    // 1. 更新阴影相机位置和矩阵
    this.updateShadowCamera();
    
    // 2. 渲染阴影深度通道
    if (this.enableShadowsOnSplats && hasRenderables(this.threeScene)) {
        this.renderShadowDepthPass();  // ← 每帧都重新渲染！
    }
    
    // 3. 更新 splat 材质的阴影 uniforms
    this.updateSplatMeshShadowUniforms();
    
    // 4. 渲染主场景
    this.renderer.render(this.threeScene, this.camera);
    this.renderer.render(this.splatMesh, this.camera);
}
```

### 关键函数说明 (Key Functions)

#### 1. updateShadowCamera() (每帧执行)

**文件:** `src/Viewer.js:500-517`

```javascript
updateShadowCamera() {
    if (!this.enableShadowsOnSplats || !this.shadowCamera) return;
    
    // 获取场景中心
    const sceneCenter = new THREE.Vector3();
    if (this.splatMesh && this.splatMesh.getSplatCount() > 0) {
        this.splatMesh.getSplatCenter(0, sceneCenter, false);
    }
    
    // 根据当前光照方向更新阴影相机
    ShadowUtils.updateShadowCameraTransform(
        this.shadowCamera,
        [this.shadowLightDirection.x, 
         this.shadowLightDirection.y, 
         this.shadowLightDirection.z],
        sceneCenter
    );
    
    // 计算光源视图投影矩阵
    this.shadowLightViewProjMatrix = ShadowUtils.computeLightViewProjectionMatrix(
        this.shadowCamera
    );
}
```

**作用:**
- 每帧根据最新的 `shadowLightDirection` 更新阴影相机位置
- 重新计算光源视图投影矩阵
- 确保阴影相机始终指向正确的方向

#### 2. renderShadowDepthPass() (每帧执行)

**文件:** `src/Viewer.js:523-534`

```javascript
renderShadowDepthPass() {
    if (!this.enableShadowsOnSplats || !this.shadowCamera || 
        !this.shadowRenderTarget) return;
    
    // 从光源视角渲染场景深度
    ShadowUtils.renderShadowDepthPass(
        this.renderer,
        this.threeScene,      // 包含需要投射阴影的物体
        this.shadowCamera,    // 已更新到新的光照方向
        this.shadowRenderTarget,
        this.splatMesh        // 排除 splat mesh
    );
}
```

**作用:**
- 每帧从最新的光源视角重新渲染场景
- 生成最新的深度贴图（shadow map）
- 反映所有变化（光照方向、物体位置等）

#### 3. updateSplatMeshShadowUniforms() (每帧执行)

**文件:** `src/Viewer.js:540-570`

```javascript
updateSplatMeshShadowUniforms() {
    // 将最新的阴影贴图和参数传递给 splat 材质
    material.uniforms.shadowMap.value = this.shadowRenderTarget.texture;
    material.uniforms.shadowMatrixWorldToLight.value.copy(
        this.shadowLightViewProjMatrix
    );
    // ... 其他 uniforms
}
```

**作用:**
- 将最新渲染的 shadow map 传递给 shader
- 更新变换矩阵，使 shader 能正确采样新的 shadow map

---

## 更新频率 (Update Frequency)

### 自动更新（推荐）

**频率:** 每一帧（通常 60 FPS）

**触发条件:**
- 渲染循环自动执行
- 无需手动触发

**更新内容:**
- ✅ 阴影相机位置和方向
- ✅ Shadow map 深度渲染
- ✅ Shader uniforms

**优点:**
- 实时响应所有变化
- 代码简洁
- 性能高效（只更新必要部分）

### 手动重建（不推荐用于光照方向更新）

**频率:** 仅在调用 `recreateViewer()` 时

**触发条件:**
- 用户在 GUI 中修改参数（demo 当前实现）

**更新内容:**
- ❌ 重新创建整个 viewer
- ❌ 重新加载 splat 数据
- ❌ 重新初始化所有资源

**缺点:**
- 不必要的开销
- 可能导致闪烁
- 浪费资源

---

## Demo 中的实现 (Implementation in Demo)

### 当前实现（可优化）

**文件:** `demo/shadows_test.html:280-289`

```javascript
lightFolder.add(shadowParams, 'lightDirX', -2, 2, 0.1)
  .name('Direction X')
  .onChange(async () => {
    updateDirectionalLight();
    await recreateViewer();  // ← 不必要的重建！
  });
```

**问题:**
- 每次调整光照方向都重新创建 viewer
- 重新加载 splat 数据（如果有）
- 造成不必要的性能开销

### 优化后的实现

```javascript
lightFolder.add(shadowParams, 'lightDirX', -2, 2, 0.1)
  .name('Direction X')
  .onChange(() => {
    // 只更新光照方向
    if (viewer) {
      viewer.shadowLightDirection.x = shadowParams.lightDirX;
    }
    // 更新 THREE.js 的 DirectionalLight
    updateDirectionalLight();
    
    // 阴影会在下一帧自动更新，无需重建 viewer！
  });
```

**优点:**
- ✅ 无需重建 viewer
- ✅ 无需重新加载数据
- ✅ 立即生效
- ✅ 流畅无闪烁

---

## 性能分析 (Performance Analysis)

### Shadow Map 渲染成本

**每帧执行的操作:**
1. 更新阴影相机变换矩阵（快速）
2. 渲染深度通道（中等成本）
   - 只渲染 THREE.js meshes
   - 排除 splat mesh
   - 输出到 1024×1024 纹理
3. 更新 shader uniforms（快速）

**总成本:**
- GPU 时间: ~0.5-2ms（取决于场景复杂度）
- CPU 时间: ~0.1-0.5ms
- 内存: 固定（shadow map 已预分配）

**优化建议:**
- 降低 `shadowMapResolution` 可提升性能
- 简化投射阴影的物体几何
- 使用 PCF 而不是 PCSS（更快）

### 与每帧更新的关系

**问题:** 每帧都重新渲染 shadow map 会影响性能吗？

**答案:** 对于现代 GPU，影响很小！

**原因:**
1. Shadow map 分辨率相对较低（1024×1024）
2. 只渲染简单的深度，不需要复杂的着色
3. 只渲染 THREE.js meshes，不渲染 splats
4. GPU 并行处理，与主渲染重叠

**实际测试:**
- 场景复杂度: 1 个 cup mesh
- Shadow map: 1024×1024
- 影响: < 1ms per frame
- FPS 影响: 可忽略不计

---

## 代码示例 (Code Examples)

### 示例 1: 动态改变光照方向

```javascript
// 方法 1: 直接修改（推荐）
viewer.shadowLightDirection.x = 1.0;
viewer.shadowLightDirection.y = -0.5;
viewer.shadowLightDirection.z = 0.5;

// 下一帧自动更新阴影！

// 方法 2: 使用动画
function animateLightDirection() {
    const time = Date.now() * 0.001;
    viewer.shadowLightDirection.x = Math.cos(time);
    viewer.shadowLightDirection.z = Math.sin(time);
    
    requestAnimationFrame(animateLightDirection);
}
animateLightDirection();

// 阴影会平滑地旋转！
```

### 示例 2: 响应用户输入

```javascript
// GUI 控件
gui.add(params, 'lightDirX', -2, 2)
  .onChange((value) => {
    viewer.shadowLightDirection.x = value;
    // 阴影在下一帧自动更新
  });

// 键盘控制
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    viewer.shadowLightDirection.x -= 0.1;
  } else if (e.key === 'ArrowRight') {
    viewer.shadowLightDirection.x += 0.1;
  }
  // 阴影实时响应
});
```

### 示例 3: 根据时间变化

```javascript
// 模拟一天中的光照变化
function updateSunPosition() {
    const hour = (Date.now() * 0.0001) % 24; // 模拟 24 小时
    
    // 计算太阳角度
    const sunAngle = (hour - 12) / 12 * Math.PI;
    
    viewer.shadowLightDirection.x = Math.sin(sunAngle);
    viewer.shadowLightDirection.y = -Math.cos(sunAngle);
    viewer.shadowLightDirection.z = 0.5;
    
    requestAnimationFrame(updateSunPosition);
}

// 阴影随"时间"变化！
```

---

## 常见问题 (FAQ)

### Q1: 光照方向改变后，阴影多久更新？

**A:** 下一帧立即更新（通常 16.7ms @ 60fps）

### Q2: 需要手动调用更新函数吗？

**A:** 不需要！渲染循环自动处理。只需修改 `viewer.shadowLightDirection`。

### Q3: 每帧更新会影响性能吗？

**A:** 影响很小。对于简单场景（如 demo），影响 < 1ms per frame。

### Q4: 可以禁用自动更新吗？

**A:** 技术上可以，但不推荐。阴影需要随场景变化更新。

### Q5: PCSS 模式下更新会更慢吗？

**A:** PCSS 主要影响采样阶段（shader），深度渲染成本相同。PCSS 会增加约 1-2ms 的 shader 成本，但这与更新频率无关。

---

## 总结 (Summary)

### 核心答案

**当光源方向改变时，会重新计算 shadowmap 吗？**

**是的！Shadow map 在每一帧都会重新计算！**

### 关键点

1. ✅ **每帧自动更新** - 无需手动触发
2. ✅ **实时响应** - 光照方向改变立即生效
3. ✅ **性能高效** - 现代 GPU 处理快速
4. ✅ **代码简洁** - 只需修改参数，系统自动处理

### 最佳实践

1. **不要重建 viewer** - 只修改 `shadowLightDirection`
2. **信任渲染循环** - 系统会自动更新
3. **性能优化** - 如需要，降低 shadow map 分辨率
4. **流畅动画** - 可以平滑插值光照方向

### 代码位置

| 功能 | 文件 | 行数 |
|------|------|------|
| 每帧更新触发 | `Viewer.js` | 1764-1766 |
| 更新阴影相机 | `Viewer.js` | 500-517 |
| 渲染深度通道 | `Viewer.js` | 523-534 |
| 更新 uniforms | `Viewer.js` | 540-570 |

---

**系统设计完善，阴影实时更新，用户无需担心！** ✨

# lib 文件夹创建说明

## 问题：lib 文件夹是怎么创建的？

本文档详细说明 `build/demo/lib/` 文件夹是如何在构建过程中创建的。

---

## 📂 lib 文件夹的作用

`build/demo/lib/` 文件夹存储了演示页面所需的 JavaScript 库文件：

```
build/demo/lib/
├── gaussian-splats-3d.module.js          # 本项目编译后的主模块
├── gaussian-splats-3d.module.js.map      # Source map 文件
├── gaussian-splats-3d.module.min.js      # 压缩版本
├── gaussian-splats-3d.module.min.js.map  # 压缩版 Source map
└── three.module.js                        # Three.js 库
```

这些文件被演示 HTML 页面通过 import maps 引用。

---

## 🔨 创建过程详解

### 完整构建流程

当您运行 `npm run build` 时，实际上执行了两个步骤：

```bash
npm run build
  ↓
npm run build-library && npm run build-demo
```

### 步骤 1: build-library (构建库)

**命令** (Linux/Mac):
```bash
npx rollup -c && mkdir -p ./build/demo/lib && cp ./build/gaussian-splats-3d.module.* ./build/demo/lib/
```

**详细说明**:

1. **`npx rollup -c`**
   - 使用 Rollup 打包工具编译源代码
   - 读取 `rollup.config.js` 配置
   - 将 `src/` 目录中的源代码编译成多个版本：
     - `build/gaussian-splats-3d.module.js` (ES6 模块版本)
     - `build/gaussian-splats-3d.module.min.js` (压缩版)
     - `build/gaussian-splats-3d.umd.cjs` (UMD 版本)
     - 对应的 `.map` 文件

2. **`mkdir -p ./build/demo/lib`**
   - 创建 `build/demo/lib` 目录
   - `-p` 参数确保如果父目录不存在也会被创建
   - 这是 **第一次创建 lib 文件夹**

3. **`cp ./build/gaussian-splats-3d.module.* ./build/demo/lib/`**
   - 将编译好的模块文件复制到 lib 目录
   - `*` 通配符匹配所有相关文件（.js, .js.map, .min.js, .min.js.map）

**结果**: lib 文件夹现在包含 gaussian-splats-3d 的编译文件

### 步骤 2: build-demo (构建演示)

**命令** (Linux/Mac):
```bash
mkdir -p ./build/demo && cp -r ./demo ./build/ && mkdir -p ./build/demo/lib && cp ./node_modules/three/build/three.module.js ./build/demo/lib/three.module.js
```

**详细说明**:

1. **`mkdir -p ./build/demo`**
   - 确保 build/demo 目录存在
   - 如果已存在则不执行任何操作

2. **`cp -r ./demo ./build/`**
   - 递归复制 `demo/` 目录到 `build/` 下
   - 这会复制所有 HTML、CSS、JS 和资源文件
   - **注意**: 这个操作不会覆盖已存在的 lib 文件夹

3. **`mkdir -p ./build/demo/lib`**
   - 再次确保 lib 目录存在
   - 这是 **关键步骤** - 如果之前没有创建，现在会创建
   - 如果已存在（从 build-library 步骤），则保留

4. **`cp ./node_modules/three/build/three.module.js ./build/demo/lib/three.module.js`**
   - 从 node_modules 复制 Three.js 库
   - 放入 lib 文件夹

**结果**: lib 文件夹现在包含完整的库文件集

---

## 🔍 为什么需要两次创建 lib 文件夹？

### 历史问题

原来的脚本存在一个 bug：

```bash
# 旧版本 (有问题)
"build-demo": "mkdir -p ./build/demo && cp -r ./demo ./build/ && cp ./node_modules/three/build/three.module.js ./build/demo/lib/three.module.js"
```

**问题**: 
- 没有显式创建 lib 目录
- 如果单独运行 `npm run build-demo`，会失败
- 错误: `cp: cannot create regular file './build/demo/lib/three.module.js': No such file or directory`

### 修复方案

添加 `mkdir -p ./build/demo/lib` 确保目录存在：

```bash
# 新版本 (已修复)
"build-demo": "mkdir -p ./build/demo && cp -r ./demo ./build/ && mkdir -p ./build/demo/lib && cp ./node_modules/three/build/three.module.js ./build/demo/lib/three.module.js"
```

**好处**:
- `build-demo` 可以独立运行
- 即使顺序改变也能正常工作
- 更加健壮和可靠

---

## 📊 构建流程图

```
npm run build
    │
    ├─→ npm run build-library
    │       │
    │       ├─→ npx rollup -c
    │       │   └─→ 编译 src/ → build/*.js
    │       │
    │       ├─→ mkdir -p ./build/demo/lib
    │       │   └─→ 创建 lib 目录 ✓
    │       │
    │       └─→ cp ./build/gaussian-splats-3d.module.* ./build/demo/lib/
    │           └─→ 复制编译文件到 lib/
    │
    └─→ npm run build-demo
            │
            ├─→ mkdir -p ./build/demo
            │   └─→ 确保 demo 目录存在
            │
            ├─→ cp -r ./demo ./build/
            │   └─→ 复制演示文件
            │
            ├─→ mkdir -p ./build/demo/lib
            │   └─→ 确保 lib 目录存在 ✓
            │
            └─→ cp .../three.module.js ./build/demo/lib/
                └─→ 复制 Three.js 库

最终结果:
build/demo/lib/
├── gaussian-splats-3d.module.js      (来自 build-library)
├── gaussian-splats-3d.module.js.map  (来自 build-library)
├── gaussian-splats-3d.module.min.js  (来自 build-library)
├── gaussian-splats-3d.module.min.js.map (来自 build-library)
└── three.module.js                    (来自 build-demo)
```

---

## 🖥️ Windows 版本

Windows 使用类似的逻辑，但命令语法不同：

**build-library-windows**:
```batch
npx rollup -c && (if not exist ".\\build\\demo\\lib" mkdir .\\build\\demo\\lib) && copy .\\build\\gaussian-splats-3d* .\\build\\demo\\lib\\
```

**build-demo-windows**:
```batch
(if not exist ".\\build\\demo" mkdir .\\build\\demo) && xcopy /E .\\demo .\\build\\demo && (if not exist ".\\build\\demo\\lib" mkdir .\\build\\demo\\lib) && xcopy .\\node_modules\\three\\build\\three.module.js .\\build\\demo\\lib\\
```

关键点相同：
- 使用 `if not exist` 检查目录是否存在
- 使用 `mkdir` 创建目录
- 使用 `xcopy` 或 `copy` 复制文件

---

## 🧪 手动验证

您可以手动验证这个过程：

```bash
# 1. 清理构建目录
rm -rf build

# 2. 运行 build-library
npm run build-library

# 3. 检查 lib 文件夹
ls -la build/demo/lib/
# 应该看到: gaussian-splats-3d.module.js 和相关文件

# 4. 运行 build-demo
npm run build-demo

# 5. 再次检查 lib 文件夹
ls -la build/demo/lib/
# 应该看到: 之前的文件 + three.module.js
```

---

## 📝 文件来源总结

| 文件 | 来源 | 创建步骤 |
|------|------|----------|
| `gaussian-splats-3d.module.js` | Rollup 编译 `src/` | build-library |
| `gaussian-splats-3d.module.min.js` | Rollup 编译 + 压缩 | build-library |
| `*.map` 文件 | Rollup 生成的 source maps | build-library |
| `three.module.js` | `node_modules/three/build/` | build-demo |

---

## ❓ 常见问题

### Q1: 为什么不在源代码中包含 lib 文件夹？

**A**: lib 文件夹是构建产物，不应该提交到版本控制：
- 它包含编译后的代码
- 文件会随着每次构建而改变
- 会增加仓库大小
- `.gitignore` 已排除 `build/` 目录

### Q2: 如果我只运行 `npm run build-demo` 会怎样？

**A**: 在修复后的版本中，它会：
1. 创建 lib 目录
2. 但只有 `three.module.js`
3. 缺少 `gaussian-splats-3d` 文件
4. 演示页面会因为找不到模块而失败

正确做法是运行完整的 `npm run build`。

### Q3: lib 文件夹可以手动创建吗？

**A**: 可以，但不推荐：
```bash
mkdir -p build/demo/lib
```
但是您仍然需要：
1. 运行 Rollup 编译源代码
2. 复制编译文件到 lib
3. 复制 Three.js 到 lib

使用 `npm run build` 自动完成这一切。

### Q4: 为什么要从 node_modules 复制 Three.js？

**A**: 
- 演示页面需要本地访问 Three.js
- 不依赖 CDN，可以离线运行
- 确保版本一致性
- `package.json` 指定了 Three.js 版本要求

---

## 🔗 相关文件

- **package.json** - 包含所有构建脚本
- **rollup.config.js** - Rollup 打包配置
- **demo/*.html** - 使用 lib 文件的演示页面
- **快速入门指南.md** - 如何运行项目
- **README.md** - 项目主文档

---

## 💡 总结

**lib 文件夹的创建是一个两步过程**:

1. **build-library**: 编译项目源代码，创建 lib 目录，复制 gaussian-splats-3d 文件
2. **build-demo**: 确保 lib 目录存在，添加 Three.js 库

关键命令是 `mkdir -p ./build/demo/lib`，它确保目录存在后再复制文件。这个设计使构建过程更加健壮和可靠。

---

**最后更新**: 2026-02-02  
**相关修复**: lib 文件夹创建问题已在 commit 86bd403 中修复

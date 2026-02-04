import * as THREE from 'three';

/**
 * Utility class for managing directional shadow mapping
 */
export class ShadowUtils {

    /**
     * Check if WebGL2 is supported
     * @param {THREE.WebGLRenderer} renderer - THREE.js renderer
     * @return {boolean} True if WebGL2 is supported
     */
    static isWebGL2Supported(renderer) {
        const gl = renderer.getContext();
        return gl instanceof WebGL2RenderingContext;
    }

    /**
     * Create a shadow render target for depth rendering
     * @param {number} resolution - Shadow map resolution (e.g., 1024)
     * @return {THREE.WebGLRenderTarget} Shadow render target
     */
    static createShadowRenderTarget(resolution) {
        const shadowRenderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: true,
            stencilBuffer: false
        });

        return shadowRenderTarget;
    }

    /**
     * Create orthographic camera for directional light
     * @param {number} orthoSize - Size of orthographic frustum
     * @param {Array<number>} nearFar - [near, far] clip planes
     * @return {THREE.OrthographicCamera} Shadow camera
     */
    static createShadowCamera(orthoSize, nearFar) {
        const camera = new THREE.OrthographicCamera(
            -orthoSize, orthoSize,
            orthoSize, -orthoSize,
            nearFar[0], nearFar[1]
        );
        return camera;
    }

    /**
     * Update shadow camera position and orientation based on light direction
     * @param {THREE.OrthographicCamera} camera - Shadow camera
     * @param {Array<number>} lightDirection - Light direction [x, y, z]
     * @param {THREE.Vector3} sceneCenter - Center of the scene
     * @param {number} distance - Distance from scene center
     */
    static updateShadowCameraTransform(camera, lightDirection, sceneCenter, distance = 20) {
        // Normalize light direction
        const dir = new THREE.Vector3(lightDirection[0], lightDirection[1], lightDirection[2]).normalize();

        // Position camera at light source location (in the direction of light)
        // lightDirection represents where light comes FROM, so camera should be there
        const lightPos = new THREE.Vector3().copy(sceneCenter).addScaledVector(dir, distance);

        // Look at scene center
        camera.position.copy(lightPos);
        camera.lookAt(sceneCenter);
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();
    }

    /**
     * Compute light view-projection matrix
     * @param {THREE.OrthographicCamera} shadowCamera - Shadow camera
     * @return {THREE.Matrix4} Light view-projection matrix
     */
    static computeLightViewProjectionMatrix(shadowCamera) {
        const lightViewProjMatrix = new THREE.Matrix4();
        lightViewProjMatrix.multiplyMatrices(
            shadowCamera.projectionMatrix,
            shadowCamera.matrixWorldInverse
        );
        return lightViewProjMatrix;
    }

    /**
     * Create a depth material for rendering shadow map
     * @return {THREE.ShaderMaterial} Depth material
     */
    static createDepthMaterial() {
        return new THREE.ShaderMaterial({
            vertexShader: `
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                void main() {
                    // Store linear depth in [0,1] range
                    float depth = gl_FragCoord.z;
                    gl_FragColor = vec4(depth, depth, depth, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });
    }

    /**
     * Auto-fit shadow camera to scene bounds
     * @param {THREE.OrthographicCamera} camera - Shadow camera
     * @param {THREE.Box3} sceneBounds - Scene bounding box
     * @param {Array<number>} lightDirection - Light direction [x, y, z]
     * @param {number} padding - Extra padding factor (default 1.2)
     * @return {number} Computed ortho size
     */
    static autoFitShadowCamera(camera, sceneBounds, lightDirection, padding = 1.2) {
        if (!sceneBounds.isEmpty()) {
            const size = new THREE.Vector3();
            sceneBounds.getSize(size);

            // Use maximum dimension for ortho size
            const maxDim = Math.max(size.x, size.y, size.z);
            const orthoSize = maxDim * padding * 0.5;

            camera.left = -orthoSize;
            camera.right = orthoSize;
            camera.top = orthoSize;
            camera.bottom = -orthoSize;

            // Update camera
            const center = new THREE.Vector3();
            sceneBounds.getCenter(center);
            const distance = maxDim * 2;
            this.updateShadowCameraTransform(camera, lightDirection, center, distance);

            return orthoSize;
        }

        return 10; // Default fallback
    }

    /**
     * Render scene depth to shadow map
     * @param {THREE.WebGLRenderer} renderer - THREE.js renderer
     * @param {THREE.Scene} scene - Scene to render
     * @param {THREE.OrthographicCamera} shadowCamera - Shadow camera
     * @param {THREE.WebGLRenderTarget} shadowTarget - Shadow render target
     * @param {THREE.Object3D} excludeObject - Object to exclude from shadow casting (e.g., splat mesh)
     */
    static renderShadowDepthPass(renderer, scene, shadowCamera, shadowTarget, excludeObject = null) {
        // Save renderer state
        const currentRenderTarget = renderer.getRenderTarget();
        const currentAutoClear = renderer.autoClear;

        // Temporarily hide excluded object
        let wasVisible = true;
        if (excludeObject) {
            wasVisible = excludeObject.visible;
            excludeObject.visible = false;
        }

        // Render to shadow target
        renderer.setRenderTarget(shadowTarget);
        renderer.autoClear = true;
        renderer.clear();
        renderer.render(scene, shadowCamera);

        // Restore state
        renderer.setRenderTarget(currentRenderTarget);
        renderer.autoClear = currentAutoClear;

        if (excludeObject) {
            excludeObject.visible = wasVisible;
        }
    }

    /**
     * Compute scene bounds from a THREE.Scene
     * @param {THREE.Scene} scene - Scene to compute bounds for
     * @return {THREE.Box3} Bounding box
     */
    static computeSceneBounds(scene) {
        const bounds = new THREE.Box3();

        scene.traverse((object) => {
            if (object.isMesh && object.geometry) {
                if (!object.geometry.boundingBox) {
                    object.geometry.computeBoundingBox();
                }

                const box = object.geometry.boundingBox.clone();
                box.applyMatrix4(object.matrixWorld);
                bounds.union(box);
            }
        });

        return bounds;
    }
}

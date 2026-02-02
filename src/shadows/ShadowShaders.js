/**
 * Shadow shader chunks for PCF and PCSS shadow mapping
 */

export class ShadowShaders {

    /**
     * Get vertex shader code for shadow coordinate calculation
     * @return {string} GLSL vertex shader code
     */
    static getVertexShaderCode() {
        return `
            uniform mat4 shadowMatrixWorldToLight;
            varying vec4 vShadowCoord;
        `;
    }

    /**
     * Get vertex shader code for transforming position to shadow space
     * Should be called in main() after computing world position
     * @return {string} GLSL code snippet
     */
    static getVertexShaderTransform() {
        return `
            // Transform splat center to light space for shadow mapping
            vec4 worldPos = modelMatrix * vec4(splatCenter, 1.0);
            vShadowCoord = shadowMatrixWorldToLight * worldPos;
        `;
    }

    /**
     * Get fragment shader uniforms and varyings for shadow mapping
     * @return {string} GLSL fragment shader code
     */
    static getFragmentShaderUniforms() {
        return `
            uniform sampler2D shadowMap;
            uniform vec2 shadowMapSize;
            uniform float shadowBias;
            uniform vec2 shadowNearFar;
            uniform float shadowLightRadius;
            uniform int enablePCSS;
            uniform int enableShadows;
            varying vec4 vShadowCoord;
        `;
    }

    /**
     * Get PCF shadow sampling function
     * @return {string} GLSL function code
     */
    static getPCFFunction() {
        return `
            float getPCFShadow(sampler2D shadowMap, vec4 shadowCoord, vec2 shadowMapSize, float bias) {
                // Perform perspective divide
                vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
                
                // Transform to [0,1] range
                projCoords = projCoords * 0.5 + 0.5;
                
                // Outside shadow map bounds - no shadow
                if (projCoords.x < 0.0 || projCoords.x > 1.0 || 
                    projCoords.y < 0.0 || projCoords.y > 1.0 ||
                    projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0;
                }
                
                float currentDepth = projCoords.z;
                
                // PCF filtering with 3x3 kernel
                float shadow = 0.0;
                vec2 texelSize = 1.0 / shadowMapSize;
                
                for(int x = -1; x <= 1; ++x) {
                    for(int y = -1; y <= 1; ++y) {
                        vec2 offset = vec2(float(x), float(y)) * texelSize;
                        float pcfDepth = texture2D(shadowMap, projCoords.xy + offset).r;
                        shadow += (currentDepth - bias) > pcfDepth ? 0.0 : 1.0;
                    }
                }
                shadow /= 9.0;
                
                return shadow;
            }
        `;
    }

    /**
     * Get PCSS shadow sampling function with soft shadows
     * @return {string} GLSL function code
     */
    static getPCSSFunction() {
        return `
            // Blocker search for PCSS
            float findBlockerDistance(sampler2D shadowMap, vec2 uv, float receiverDepth, 
                                     float lightRadius, vec2 shadowMapSize) {
                float blockerSum = 0.0;
                float numBlockers = 0.0;
                float searchRadius = lightRadius;
                
                vec2 texelSize = 1.0 / shadowMapSize;
                int searchSamples = 16;
                
                for(int i = 0; i < searchSamples; ++i) {
                    float angle = float(i) * 6.283185 / float(searchSamples);
                    float radius = searchRadius * (float(i) + 0.5) / float(searchSamples);
                    vec2 offset = vec2(cos(angle), sin(angle)) * radius * texelSize;
                    
                    float shadowDepth = texture2D(shadowMap, uv + offset).r;
                    if (shadowDepth < receiverDepth) {
                        blockerSum += shadowDepth;
                        numBlockers += 1.0;
                    }
                }
                
                if (numBlockers == 0.0) {
                    return -1.0;
                }
                
                return blockerSum / numBlockers;
            }
            
            float getPCSSShadow(sampler2D shadowMap, vec4 shadowCoord, vec2 shadowMapSize, 
                               float bias, float lightRadius) {
                // Perform perspective divide
                vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
                
                // Transform to [0,1] range
                projCoords = projCoords * 0.5 + 0.5;
                
                // Outside shadow map bounds - no shadow
                if (projCoords.x < 0.0 || projCoords.x > 1.0 || 
                    projCoords.y < 0.0 || projCoords.y > 1.0 ||
                    projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0;
                }
                
                float currentDepth = projCoords.z;
                
                // Step 1: Blocker search
                float blockerDepth = findBlockerDistance(shadowMap, projCoords.xy, 
                                                        currentDepth - bias, lightRadius, shadowMapSize);
                
                if (blockerDepth < 0.0) {
                    // No blockers found
                    return 1.0;
                }
                
                // Step 2: Penumbra estimation
                float penumbraWidth = (currentDepth - blockerDepth) / blockerDepth;
                float filterRadius = penumbraWidth * lightRadius;
                
                // Step 3: PCF with adaptive filter size
                float shadow = 0.0;
                vec2 texelSize = 1.0 / shadowMapSize;
                int pcfSamples = 16;
                
                for(int i = 0; i < pcfSamples; ++i) {
                    float angle = float(i) * 6.283185 / float(pcfSamples);
                    float radius = filterRadius * (float(i) + 0.5) / float(pcfSamples);
                    vec2 offset = vec2(cos(angle), sin(angle)) * radius * texelSize;
                    
                    float pcfDepth = texture2D(shadowMap, projCoords.xy + offset).r;
                    shadow += (currentDepth - bias) > pcfDepth ? 0.0 : 1.0;
                }
                shadow /= float(pcfSamples);
                
                return shadow;
            }
        `;
    }

    /**
     * Get complete fragment shader code for shadow calculation
     * @param {boolean} includePCSS - Whether to include PCSS code
     * @return {string} GLSL fragment shader code
     */
    static getFragmentShaderCode(includePCSS = true) {
        let code = this.getFragmentShaderUniforms() + '\n';
        code += this.getPCFFunction() + '\n';

        if (includePCSS) {
            code += this.getPCSSFunction() + '\n';
        }

        return code;
    }

    /**
     * Get the shadow calculation snippet to use in fragment shader main()
     * @return {string} GLSL code snippet
     */
    static getFragmentShaderShadowCalc() {
        return `
            float shadowFactor = 1.0;
            if (enablePCSS == 1) {
                shadowFactor = getPCSSShadow(shadowMap, vShadowCoord, shadowMapSize, 
                                            shadowBias, shadowLightRadius);
            } else {
                shadowFactor = getPCFShadow(shadowMap, vShadowCoord, shadowMapSize, shadowBias);
            }
        `;
    }
}

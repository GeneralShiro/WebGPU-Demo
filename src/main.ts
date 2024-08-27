/// <reference types="@webgpu/types" />

import { shadersMap } from "./shaders-map";

async function init() {
    // determine if the browser supports WebGPU
    if (!navigator.gpu) {
        throw Error("WebGPU not supported.");
    }

    // get adapter
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw Error("Couldn't request WebGPU adapter.");
    }

    // get device
    const device = await adapter.requestDevice();

    // create shader modules
    const shader_demo = await fetchShaderFile('demo');
    const shaderModule_demo = device.createShaderModule({
        code: shader_demo
    });

    // configure canvas element
    const canvas = document.querySelector('#webgpu-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('No canvas found to render to!');
    }
    const context = canvas.getContext("webgpu");
    context.configure({
        device: device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        alphaMode: "premultiplied"
    });

    // demo vertices -- multicolored triangle
    const vertices = new Float32Array([
        0.0, 0.6, 0, 1,     // position 1 (XYZW)
        1, 0, 0, 1,         // color 1 (RGBA)
        -0.5, -0.6, 0, 1,   // position 2
        0, 1, 0, 1,         // color 2
        0.5, -0.6, 0, 1,    // position 3
        0, 0, 1, 1          // color 3
    ]);

    // create a buffer on device
    /* 
    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);*/
    const vertexBuffer: GPUBuffer = createGPUBuffer(device, vertices, GPUBufferUsage.VERTEX);

    // define how the buffer data should be viewed by the shader module
    const vertexBufferLayout: GPUVertexBufferLayout[] = [
        {
            attributes: [
                {
                    shaderLocation: 0,      // position
                    offset: 0,
                    format: "float32x4",    // 16-bytes
                },
                {
                    shaderLocation: 1,      // color
                    offset: 16,
                    format: "float32x4",
                },
            ],
            arrayStride: 32,    // each vertex has position (16-bytes) and color (16-bytes) = 32
            stepMode: "vertex",
        },
    ];

    // -- create render pipeline --
    // create pipeline layout
    const pipelineLayoutDesc: GPUPipelineLayoutDescriptor = { bindGroupLayouts: [] };
    const layout = device.createPipelineLayout(pipelineLayoutDesc);
    // define configuration of the render pipeline's stages    
    const pipelineDescriptor: GPURenderPipelineDescriptor = {
        vertex: {
            module: shaderModule_demo,      // see 'shaders/demo.wgsl'
            entryPoint: "vertex_main",
            buffers: vertexBufferLayout,
        },
        fragment: {
            module: shaderModule_demo,      // see 'shaders/demo.wgsl'
            entryPoint: "fragment_main",
            targets: [
                {
                    format: navigator.gpu.getPreferredCanvasFormat(),
                },
            ],
        },
        primitive: {
            topology: "triangle-list",      // we'll draw triangles for this demo
        },
        layout: layout
    };
    // create GPURenderPipepline object
    const renderPipeline = device.createRenderPipeline(pipelineDescriptor);

    // -- run a rendering pass --
    // create command encoder to send commands to GPU
    const commandEncoder = device.createCommandEncoder();

    // queue command to begin pass
    const clearColor = { r: 0.0, g: 0.5, b: 1.0, a: 1.0 };
    const renderPassDesc = {
        colorAttachments: [
            {
                clearValue: clearColor,                             // what color to show after clearing all drawing
                loadOp: "clear",
                storeOp: "store",                                   // store the value of the current pass
                view: context.getCurrentTexture().createView()      // create a texture to render to using the canvas context
            }
        ]
    }
    const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);

    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);

    // draw demo triangle
    passEncoder.setPipeline(renderPipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.draw(3)     // draw the 3 vertices of the triangle

    // finalize sequence of commands and send them to the GPU
    passEncoder.end();                                  // marks the end of a command sequence
    device.queue.submit([commandEncoder.finish()]);     // queue the sequence of commands on the device to send to the GPU
}

/**
 * @summary Try to fetch the WGSL shader code from a loaded .wgsl file, placed in the <head> of the index HTML file.
 */
async function fetchShaderFile(id) {
    // find source path from array of shaders
    let src;
    for (let i = 0; i < shadersMap.length; i++) {
        if (shadersMap[i].id === id) {
            src = shadersMap[i].src;
            break;
        }
    }
    if (!src) {
        console.error(`Failed to find shader with \"${id}\"!`);
        return;
    }

    // try to fetch the text of the shader from the specified file
    try {
        const response = await fetch(src);
        if (!response.ok) {
            throw new Error("Network response was not ok.");
        }
        const content = await response.text();
        return content;
    } catch (error) {
        console.error(`Error while fetching shader file \"${id}\":`, error);
    }
}

async function loadModel(id) {

}

function createGPUBuffer(device: GPUDevice, buffer, usage: GPUBufferUsageFlags) {
    const bufferDesc: GPUBufferDescriptor = {
        size: buffer.byteLength,
        usage: usage,
        mappedAtCreation: true
    };
    let gpuBuffer = device.createBuffer(bufferDesc);

    if (buffer instanceof Float32Array) {
        const writeArrayNormal = new Float32Array(gpuBuffer.getMappedRange());
        writeArrayNormal.set(buffer);
    }
    else if (buffer instanceof Uint32Array) {
        const writeArrayNormal = new Uint32Array(gpuBuffer.getMappedRange());
        writeArrayNormal.set(buffer);
    }
    else if (buffer instanceof Uint16Array) {
        const writeArrayNormal = new Uint16Array(gpuBuffer.getMappedRange());
        writeArrayNormal.set(buffer);
    }
    else if (buffer instanceof Uint8Array) {
        const writeArrayNormal = new Uint8Array(gpuBuffer.getMappedRange());
        writeArrayNormal.set(buffer);
    }
    else {
        const writeArrayNormal = new Float32Array(gpuBuffer.getMappedRange());
        writeArrayNormal.set(buffer);
        console.error("Unhandled buffer format ", typeof gpuBuffer);
    }

    gpuBuffer.unmap();
    return gpuBuffer;
}

document.addEventListener('DOMContentLoaded', init);

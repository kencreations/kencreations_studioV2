import * as THREE from 'three';
import Module from 'manifold-3d';
import { initializeContainerKernel, createContainerGeometry, addBodyKeychainLoop, personalizeLid, containerDimensions } from '../src/utils/screwContainerGeometry.js';
import { load3DFont } from '../src/utils/fontManager.js';

async function test() {
    console.log("Initializing kernel...");
    await initializeContainerKernel();
    console.log("Kernel ready!");

    const config = {
        innerDiameter: 50,
        innerHeight: 12.5,
        wallThickness: 2,
        bottomThickness: 1.2,
        lidHeight: 10,
        threadHeight: 10,
        clearance: 0.25,
        lipDepth: 2.5,
        addKeychainHole: true,
        personalized: true,
        personText: "KEN",
        personStyle: "embossed",
        personSize: 8,
        personDepth: 0.8,
        personAutoFit: true,
        viewMode: "assembled",
        printMode: "full",
        containerStyle: "classic",
        lidStyle: "personalized"
    };

    const dims = containerDimensions(config);
    console.log("Dims:", dims);

    const bodyShell = createContainerGeometry(config, 'body', false);
    console.log("Body shell vertices:", bodyShell.attributes.position.count, "indices:", bodyShell.index.count);

    const bodyWithLoop = addBodyKeychainLoop(bodyShell, config);
    console.log("Body with loop vertices:", bodyWithLoop.attributes.position.count, "indices:", bodyWithLoop.index.count);

    console.log("Success!");
}

test().catch(console.error);

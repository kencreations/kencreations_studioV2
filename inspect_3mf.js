import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import fs from 'fs';
import { DOMParser } from 'xmldom';

global.DOMParser = DOMParser;

const loader = new ThreeMFLoader();
const data = fs.readFileSync('c:/Users/Ken/Desktop/kencreations-v2/src/assets/models/popsocket.3mf');

try {
    const object = loader.parse(data.buffer);
    console.log("Parse success. Children count:", object.children.length);
    
    let geom = null;
    object.traverse((child) => {
        if (child.isMesh && !geom) {
            geom = child.geometry;
            console.log("Found mesh:", child.name);
        }
    });
    
    if (geom) {
        geom.computeBoundingBox();
        console.log("Bounding Box:", geom.boundingBox);
    }
} catch (e) {
    console.error("Parse error", e);
}

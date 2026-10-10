const THREE = require('three');
const shape = new THREE.Shape();
shape.moveTo(0, 0); shape.lineTo(10, 0); shape.lineTo(10, 10); shape.lineTo(0, 10); shape.lineTo(0, 0);
const geo = new THREE.ExtrudeGeometry(shape, { depth: 4, bevelEnabled: false });
geo.rotateX(-Math.PI / 2);
geo.computeBoundingBox();
console.log(geo.boundingBox);

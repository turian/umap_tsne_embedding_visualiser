// create WebAudio API context
var context = new AudioContext()

// Create lineOut
var lineOut = new WebAudiox.LineOut(context)
lineOut.volume = 0.4;

var currentAudioSource = null;
var data = JSON.parse(d);

for (var i in data) {
  console.log(i)
}

function getData(method, feature, a, b) {
  var key;
  if (method.toString() == "pca") {
    key = method.toString() + feature.toString();
  } else if (method.toString() == "tsne") {
    key = method.toString() + feature.toString() + b.toString() + a.toString();
  } else {
    key = method.toString() + feature.toString() + a.toString() + b.toString();
  }
  return data[key];
}

var filePaths = data['filenames'];

var renderer, scene, camera, stats;
var pointclouds;
var raycaster;
var mouse = new THREE.Vector2();
var intersection = null;
var spheres = [];
var spheresIndex = 0;
var clock;
var mouseHasMoved = false;
var sound = null;
var interpolating = false;
var interpolatingAmount = 0;
var interpolationSpeed = 0.01;
var target = null;
var target_colors = null;
var previousSampleIndex = -1;
var threshold = 0.1;
var pointSize = 2;
var width = 150;
var length = 150;

var drawerWidth = document.getElementById("drawer").clientWidth;
var titleHeight = document.getElementById("header").clientHeight;
var renderWidth = window.innerWidth - drawerWidth;
var renderHeight = window.innerHeight - titleHeight;

init();
animate();

function stopAudio() {
  if (currentAudioSource && (typeof currentAudioSource.stop === 'function')) {
    currentAudioSource.stop();
  }
}

function updateGraph() {
  var slider1 = parseInt(document.getElementById("slider1").value) - 1;
  var slider2 = parseInt(document.getElementById("slider2").value) - 1;

  var method = null;
  var methodOptions = document.getElementsByClassName('mdl-radio__button');
  for (var i = 0; methodOptions[i]; ++i) {
    let id = methodOptions[i].id.toString();
    if (methodOptions[i].checked && (id.indexOf("method") != -1)) {
      method = methodOptions[i].value;
      break;
    }
  }

  var feature = null;
  var featureOptions = document.getElementsByClassName('mdl-radio__button');
  for (var i = 0; featureOptions[i]; ++i) {
    let id = featureOptions[i].id.toString();
    if (featureOptions[i].checked && (id.indexOf("feature") != -1)) {
      feature = featureOptions[i].value;
      break;
    }
  }

  if (method == "umap") {
    document.getElementById("sliders").style.visibility = "visible";
    document.getElementById("slider-text-1").innerHTML = "Neighbours";
    document.getElementById("slider-text-2").innerHTML = "Distances";
  } else if (method == "tsne") {
    document.getElementById("sliders").style.visibility = "visible";
    document.getElementById("slider-text-1").innerHTML = "Perplexity";
    document.getElementById("slider-text-2").innerHTML = "Iterations";
  } else if (method == "pca") {
    document.getElementById("sliders").style.visibility = "hidden";
  }

  let targetData = getData(method, feature, slider1, slider2);
  const {
    positions,
    colors
  } = generatePositionsFromData(targetData);

  target = positions;
  target_colors = colors;

  interpolating = true;
  interpolatingAmount = 0;
}

function generatePositionsFromData(data) {
  var positions = new Float32Array(data.length * 3);
  var colors = new Float32Array(data.length * 3);

  for (var i = 0; i < data.length; ++i) {

    let x = data[i]['coordinates'][0] - 0.5;
    let y = data[i]['coordinates'][1] - 0.5;
    let z = 0;

    positions[3 * i] = x;
    positions[3 * i + 1] = y;
    positions[3 * i + 2] = z;

    let r = 0;
    let g = 0;
    let b = 0;
    if (color_presets[i]) {
      color_presets[i].r && (r = color_presets[i].r);
      color_presets[i].g && (g = color_presets[i].g);
      color_presets[i].b && (b = color_presets[i].b);
    }
    colors[3 * i] = r;
    colors[3 * i + 1] = g;
    colors[3 * i + 2] = b;
  }

  return {
    positions,
    colors
  };
}

function generatePointCloudGeometry(data) {
  var geometry = new THREE.BufferGeometry();
  const {
    positions,
    colors,
  } = generatePositionsFromData(data);

  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();

  return geometry;
}

function generatePointcloud(data) {

  var geometry = generatePointCloudGeometry(data);

  var material = new THREE.PointsMaterial({
    size: pointSize,
    vertexColors: THREE.VertexColors,
    sizeAttenuation: false
  });
  var pointcloud = new THREE.Points(geometry, material);
  return pointcloud;

}

function init() {

  var container = document.getElementById('container');

  scene = new THREE.Scene();

  clock = new THREE.Clock();

  const near_plane = 2;
  const far_plane = 100;

  // Set up camera and scene
  camera = new THREE.PerspectiveCamera(
    20,
    renderHeight / renderHeight,
    near_plane,
    far_plane
  );

  camera.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 35));

  let jsonData = getData("umap", "wavenet", 2, 2);
  var pcBuffer = generatePointcloud(jsonData);
  pcBuffer.scale.set(10, 10, 1);
  pcBuffer.position.set(0, 0, 0);
  scene.add(pcBuffer);
  pointclouds = [pcBuffer];


  // jsonData = getData("umap", "mfcc", 2, 2);
  // pcBuffer = generatePointcloud(jsonData);
  // pcBuffer.scale.set(10, 10, 1);
  // pcBuffer.position.set(0, 0, 0);
  // scene.add(pcBuffer);

  // pointclouds = [pcBuffer];


  var sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
  var sphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000
  });

  for (var i = 0; i < 40; i++) {

    var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);
    spheres.push(sphere);

  }

  //
  renderWidth = window.innerWidth - drawerWidth;
  renderHeight = window.innerHeight - titleHeight;
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xffffff, 1);
  renderer.setSize(renderWidth, renderHeight);
  container.appendChild(renderer.domElement);

  //

  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = threshold;

  //

  stats = new Stats();
  container.appendChild(stats.dom);

  //

  window.addEventListener('resize', onWindowResize, false);
  document.addEventListener('mousemove', onDocumentMouseMove, false);

}

function onDocumentMouseMove(event) {

  mouseHasMoved = true;

  titleHeight = document.getElementById("header").clientHeight;

  if (window.innerWidth >= 1024) {
    drawerWidth = document.getElementById("drawer").clientWidth;
    mouse.x = ((event.clientX - drawerWidth) / renderWidth) * 2 - 1;
  } else {
    mouse.x = (event.clientX / renderWidth) * 2 - 1;
  }
  mouse.y = -((event.clientY - titleHeight) / (renderHeight)) * 2 + 1;
}

function onWindowResize() {

  renderWidth = window.innerWidth - drawerWidth;
  if (window.innerWidth <= 1024) {
    renderWidth = window.innerWidth;
  }
  renderHeight = window.innerHeight - titleHeight;

  camera.aspect = renderHeight / renderHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(renderWidth, renderHeight);

}

function animate() {

  requestAnimationFrame(animate);

  if (interpolating) {
    pointclouds[0].geometry.attributes.position.needsUpdate = true;

    var positions = pointclouds[0].geometry.attributes.position.array;

    interpolatingAmount += interpolationSpeed;

    if (interpolatingAmount >= 1.0) {
      interpolating = false;

      for (var i = 0; i < positions.length; ++i) {
        positions[i] = target[i];
      }
    } else {

      for (var i = 0; i < positions.length; i += 3) {
        positions[i] = THREE.Math.lerp(positions[i], target[i], interpolatingAmount);
        positions[i + 1] = THREE.Math.lerp(positions[i + 1], target[i + 1], interpolatingAmount);
      }
    }
  }

  render();
  stats.update();

}

var toggle = 0;

function render() {

  raycaster.setFromCamera(mouse, camera);

  var intersections = raycaster.intersectObjects(pointclouds);
  intersection = (intersections.length) > 0 ? intersections[0] : null;

  if (toggle > 0.02 && intersection !== null && mouseHasMoved) {

    if (previousSampleIndex != intersection.index) {
      let filepath = filePaths[intersection.index % (filePaths.length)];
      previousSampleIndex = intersection.index;

      // if (playPromise !== undefined) {
      // 	playPromise.then(_ => {
      // 		// Automatic playback started!
      // 		// Show playing UI.
      // 		// We can now safely pause video...
      // 		sound.pause();
      // 		sound.src = '';
      // 		sound.load("vengance_dataset/" + filepath);
      // 		sound.volume = 0.2;
      // 		playPromise = sound.play();
      // 	})
      // 	.catch(error => {
      // 		// Auto-play was prevented
      // 		// Show paused UI.
      // 	});
      // }
      //
      // if (sound == null) {
      // 	sound = new Audio("vengance_dataset/" + filepath);
      // }
      //
      // sound.volume = 0.2;
      // var playPromise = sound.play();

      // load a sound and play it immediatly
      // let file = "vengance_dataset/" + filepath;
      let file = filepath;
      WebAudiox.loadBuffer(context, file, function (buffer) {
        stopAudio();
        // init AudioBufferSourceNode
        var source = context.createBufferSource();
        source.buffer = buffer
        source.connect(lineOut.destination)

        // start the sound now
        source.start(0);
        currentAudioSource = source;
      });

      document.getElementById("filename").innerHTML = filepath;
    }

    spheres[spheresIndex].position.copy(intersection.point);
    spheres[spheresIndex].scale.set(1, 1, 1);
    spheresIndex = (spheresIndex + 1) % spheres.length;

    toggle = 0;

  } else {
    // stopAudio();
  }

  for (var i = 0; i < spheres.length; i++) {

    var sphere = spheres[i];
    sphere.scale.multiplyScalar(0.98);
    sphere.scale.clampScalar(0.01, 1);

  }

  toggle += clock.getDelta();

  renderer.render(scene, camera);

}
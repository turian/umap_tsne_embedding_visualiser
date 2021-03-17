// create WebAudio API context
var context = new AudioContext()

// Create lineOut
var lineOut = new WebAudiox.LineOut(context)
lineOut.volume = 0.4;

var currentAudioSource = null;
var data = JSON.parse(d);

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

var isPanning = false;
var startX = null,
  startY = null;

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
var threshold = 0.01;
var pointSize = 2;
var width = 150;
var length = 150;

var drawerWidth = document.getElementById("drawer").clientWidth;
var titleHeight = document.getElementById("header").clientHeight;
var renderWidth = window.innerWidth - drawerWidth;
var renderHeight = window.innerHeight - titleHeight;

let audioSources = [];

init();
animate();
registerPanEvents();

function stopAudio() {
  // if (currentAudioSource && (typeof currentAudioSource.stop === 'function')) {
  //   currentAudioSource.stop();
  // }
  audioSources.forEach(src => {
    if (src && (typeof src.stop === 'function')) {
      src.stop();
    }
  })
}

function updateZoom() {
  var z = parseInt(document.getElementById("slider-zoom").value);

  // camera.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 60 / z));
  camera.position.z = 700 / z;
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

function loadInitialDataset() {
  let jsonData = getData("umap", "wavenet", 2, 2);
  var pcBuffer = generatePointcloud(jsonData);
  pcBuffer.scale.set(10, 10, 1);
  pcBuffer.position.set(0, 0, 0);
  scene.add(pcBuffer);
  pointclouds = [pcBuffer];
}

function init() {

  var container = document.getElementById('container');

  scene = new THREE.Scene();

  clock = new THREE.Clock();

  const near_plane = 2;
  const far_plane = 1000;

  // Set up camera and scene
  camera = new THREE.PerspectiveCamera(
    20,
    renderHeight / renderHeight,
    near_plane,
    far_plane
  );


  camera.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 35));

  loadInitialDataset();

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


  window.addEventListener('resize', onWindowResize, false);
  document.addEventListener('mousemove', onDocumentMouseMove, false);

  onWindowResize();

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
}

var toggle = 0;

function render() {

  raycaster.setFromCamera(mouse, camera);

  var intersections = raycaster.intersectObjects(pointclouds);
  intersection = (intersections.length) > 0 ? intersections[0] : null;
  if (intersection) {
    if (toggle > 0.02 && intersection !== null && mouseHasMoved) {
      if (previousSampleIndex != intersection.index) {
        let filepath = filePaths[intersection.index % (filePaths.length)];
        previousSampleIndex = intersection.index;

        let file = filepath;

        WebAudiox.loadBuffer(context, file, function (buffer) {
          stopAudio();
          // init AudioBufferSourceNode
          var source = context.createBufferSource();
          source.buffer = buffer
          source.connect(lineOut.destination)

          // start the sound now
          source.start(0);
          audioSources.push(source);
        });

        document.getElementById("filename").innerHTML = filepath;
      }

      let index = intersection.index;
      spheres[spheresIndex].position.copy(intersection.point);
      try {
        let mat = spheres[spheresIndex].material.clone();
        mat.color.setRGB(color_presets[index].r, color_presets[index].g, color_presets[index].b);
        spheres[spheresIndex].material = mat;
      } catch (_) {
        console.log(_)
      }

      let scaleValue = 1;
      scaleValue = 20 / parseInt(document.getElementById("slider-zoom").value);
      spheres[spheresIndex].scale.set(scaleValue, scaleValue, scaleValue);
      spheresIndex = (spheresIndex + 1) % spheres.length;

      toggle = 0;

    } else {}
  } else {
    previousSampleIndex = -1;
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

function registerPanEvents() {
  let container = document.getElementById('container');

  container.addEventListener('wheel', function (e) {
    e.preventDefault();
    e.stopPropagation();
    let step = 0;
    if (e.deltaY > 0) {
      step = 1;
    } else {
      step = -1;
    }

    let zoomControl = document.getElementById('slider-zoom');
    let min = parseInt(zoomControl.getAttribute('min'));
    let max = parseInt(zoomControl.getAttribute('max'));
    zoomControl.value = zoomControl.value - 0 + step;
    if (parseInt(zoomControl.value) < min) zoomControl.value = min;
    if (parseInt(zoomControl.value) > max) zoomControl.value = max;
    zoomControl.onchange();

  })

  // start
  container.addEventListener('mousedown', function () {
    isPanning = true;
  })
  container.addEventListener('touchstart', function () {
    isPanning = true;
  })

  // move
  function onMove(e) {
    if (isPanning) {
      if (!startX && !startY) {
        startX = e.clientX;
        startY = e.clientY;
      } else {
        let dx = e.clientX - startX;
        let dy = e.clientY - startY;

        startX = e.clientX;
        startY = e.clientY;
        camera.position.x = camera.position.x - dx * panningSpeed;
        camera.position.y = camera.position.y + dy * panningSpeed;
      }
    }
  }

  container.addEventListener('mousemove', onMove)
  container.addEventListener('touchmove', onMove);

  // cancel
  container.addEventListener('mouseup', function () {
    isPanning = false;
    startX = null;
    startY = null;
  })
  container.addEventListener('touchend', function () {
    isPanning = false;
    startX = null;
    startY = null;
  })
}
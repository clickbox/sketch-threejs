var Util = require('../modules/util');
var Force2 = require('../modules/force2');
var Mover = require('../modules/mover');
var Points = require('../modules/points.js');
var ForceHemisphereLight = require('../modules/force_hemisphere_light');
var ForcePointLight = require('../modules/force_point_light');
var glslify = require('glslify');

var exports = function(){
  var Sketch = function(scene, camera) {
    this.init(scene, camera);
  };
  var movers_num = 10000;
  var movers = [];
  var mover_activate_count = 2;
  var points = new Points();
  var hemi_light = null;
  var comet_light1 = null;
  var comet_light2 = null;
  var positions = new Float32Array(movers_num * 3);
  var colors = new Float32Array(movers_num * 3);
  var opacities = new Float32Array(movers_num);
  var sizes = new Float32Array(movers_num);
  var comet = null;
  var comet_radius = 30;
  var comet_scale = new Force2();
  var comet_color_h = 140;
  var color_diff = 45;
  var planet = null;
  var last_time_activate = Date.now();
  var last_time_plus_activate = Date.now();
  var last_time_bounce = Date.now();
  var last_time_touch = Date.now();
  var plus_acceleration = 0;
  var is_touched = false;
  var is_plus_activate = false;
  var track_points = true;

  var updateMover = function() {
    for (var i = 0; i < movers.length; i++) {
      var mover = movers[i];
      var position = new THREE.Vector3();
      if (mover.is_active) {
        mover.time++;
        mover.applyDrag(0.1);
        mover.updateVelocity();
        if (mover.time > 10) {
          mover.size -= 2;
          //mover.a -= 0.04;
        }
        if (mover.size <= 0) {
          mover.init(new THREE.Vector3(0, 0, 0));
          mover.time = 0;
          mover.a = 0.0;
          mover.inactivate();
        }
      }
      positions[i * 3 + 0] = mover.velocity.x - points.velocity.x;
      positions[i * 3 + 1] = mover.velocity.y - points.velocity.y;
      positions[i * 3 + 2] = mover.velocity.z - points.velocity.z;
      colors[i * 3 + 0] = mover.color.r;
      colors[i * 3 + 1] = mover.color.g;
      colors[i * 3 + 2] = mover.color.b;
      opacities[i] = mover.a;
      sizes[i] = mover.size;
    }
    points.updatePoints();
  };

  var activateMover = function() {
    var count = 0;
    var now = Date.now();
    if (now - last_time_activate > 10) {
      for (var i = 0; i < movers.length; i++) {
        var mover = movers[i];
        if (mover.is_active) continue;
        var rad1 = Util.getRadian(Util.getRandomInt(0, 360));
        var rad2 = Util.getRadian(Util.getRandomInt(0, 360));
        var range = Util.getRandomInt(1, 30);
        var vector = Util.getPolarCoord(rad1, rad2, range);
        var force = Util.getPolarCoord(rad1, rad2, range / 20);
        var h = Util.getRandomInt(comet_color_h - color_diff, comet_color_h + color_diff) - plus_acceleration / 1.5;
        var s = Util.getRandomInt(60, 80);
        vector.add(points.velocity);
        mover.activate();
        mover.init(vector);
        mover.color.setHSL(h / 360, s / 100, 0.7);
        mover.applyForce(force);
        mover.a = 1;
        mover.size = 25;
        count++;
        if (count >= mover_activate_count) break;
      }
      last_time_activate = Date.now();
    }
  };

  var rotateComet = function() {
    comet.rotation.x += 0.03 + plus_acceleration / 1000;
    comet.rotation.y += 0.01 + plus_acceleration / 1000;
    comet.rotation.z += 0.01 + plus_acceleration / 1000;
    points.rad1_base += Util.getRadian(.6);
    points.rad1 = Util.getRadian(Math.sin(points.rad1_base) * 45 + plus_acceleration / 100);
    points.rad2 += Util.getRadian(0.8 + plus_acceleration / 100);
    points.rad3 += 0.01;
    return Util.getPolarCoord(points.rad1, points.rad2, 350);
  };

  var rotateCometColor = function() {
    var radius = comet_radius * 0.8;
    comet_light1.position.copy(Util.getPolarCoord(Util.getRadian(0),  Util.getRadian(0), radius).add(points.velocity));
    comet_light2.position.copy(Util.getPolarCoord(Util.getRadian(180), Util.getRadian(0), radius).add(points.velocity));
  };

  var bounceComet = function() {
    if (Date.now() - last_time_bounce > 1000 - plus_acceleration * 3) {
      comet_scale.applyForce(new THREE.Vector2(0.08 + plus_acceleration / 5000, 0));
      last_time_bounce = Date.now();
      is_plus_activate = true;
      last_time_plus_activate = Date.now();
    }
    if (is_plus_activate && Date.now() - last_time_plus_activate < 500) {
      mover_activate_count = 6 + Math.floor(plus_acceleration / 40);
    } else {
      mover_activate_count = 1 + Math.floor(plus_acceleration / 40);
    }
    comet_scale.applyHook(0, 0.1);
    comet_scale.applyDrag(0.12);
    comet_scale.updateVelocity();
    comet.scale.set(1 + comet_scale.velocity.x, 1 + comet_scale.velocity.x, 1 + comet_scale.velocity.x);
  };

  var createTexture = function() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var grad = null;
    var texture = null;

    canvas.width = 200;
    canvas.height = 200;
    grad = ctx.createRadialGradient(100, 100, 20, 100, 100, 100);
    grad.addColorStop(0.9, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.arc(100, 100, 100, 0, Math.PI / 180, true);
    ctx.fill();

    texture = new THREE.Texture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  };

  var createCommet = function() {
    var base_geometry = new THREE.OctahedronGeometry(comet_radius, 2);
    var geometry = new THREE.BufferGeometry();
    var material = new THREE.MeshPhongMaterial({
      color: new THREE.Color('hsl(' + comet_color_h + ', 100%, 100%)'),
      shading: THREE.FlatShading
    });
    var positions = new Float32Array(base_geometry.vertices.length * 3);
    for (var i = 0; i < base_geometry.vertices.length; i++) {
      positions[i * 3] = base_geometry.vertices[i].x;
      positions[i * 3 + 1] = base_geometry.vertices[i].y;
      positions[i * 3 + 2] = base_geometry.vertices[i].z;
    }
    var indices = new Uint32Array(base_geometry.faces.length * 3);
    for (var j = 0; j < base_geometry.faces.length; j++) {
      indices[j * 3] = base_geometry.faces[j].a;
      indices[j * 3 + 1] = base_geometry.faces[j].b;
      indices[j * 3 + 2] = base_geometry.faces[j].c;
    }
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.attributes.position.dynamic = true;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.index.dynamic = true;
    return new THREE.Mesh(geometry, material);
  };

  var createPlanet = function() {
    var geometry = new THREE.OctahedronGeometry(250, 4);
    var material = new THREE.MeshPhongMaterial({
      color: 0x222222,
      shading: THREE.FlatShading
    });
    return new THREE.Mesh(geometry, material);
  };

  var accelerateComet = function() {
    if (is_touched && plus_acceleration < 200) {
      plus_acceleration += 1;
    } else if(plus_acceleration > 0) {
      plus_acceleration -= 1;
    }
  };

  Sketch.prototype = {
    init: function(scene, camera) {
      comet = createCommet();
      scene.add(comet);
      planet = createPlanet();
      scene.add(planet);
      for (var i = 0; i < movers_num; i++) {
        var mover = new Mover();
        var h = Util.getRandomInt(comet_color_h - color_diff, comet_color_h + color_diff);
        var s = Util.getRandomInt(60, 80);
        mover.init(new THREE.Vector3(Util.getRandomInt(-100, 100), 0, 0));
        mover.color = new THREE.Color('hsl(' + h + ', ' + s + '%, 70%)');
        movers.push(mover);
        positions[i * 3 + 0] = mover.velocity.x;
        positions[i * 3 + 1] = mover.velocity.y;
        positions[i * 3 + 2] = mover.velocity.z;
        colors[i * 3 + 0] = mover.color.r;
        colors[i * 3 + 1] = mover.color.g;
        colors[i * 3 + 2] = mover.color.b;
        opacities[i] = mover.a;
        sizes[i] = mover.size;
      }
      points.init({
        scene: scene,
        vs: glslify('../../glsl/sketch/common/points.vs'),
        fs: glslify('../../glsl/sketch/common/points.fs'),
        positions: positions,
        colors: colors,
        opacities: opacities,
        sizes: sizes,
        texture: createTexture(),
        blending: THREE.NormalBlending
      });
      points.rad1 = 0;
      points.rad1_base = 0;
      points.rad2 = 0;
      points.rad3 = 0;
      hemi_light = new ForceHemisphereLight(
        new THREE.Color('hsl(' + (comet_color_h - color_diff) + ', 50%, 60%)').getHex(),
        new THREE.Color('hsl(' + (comet_color_h + color_diff) + ', 50%, 60%)').getHex(),
        1
      );
      scene.add(hemi_light);
      comet_light1 = new ForcePointLight('hsl(' + (comet_color_h - color_diff) + ', 60%, 50%)', 1, 500, 1);
      scene.add(comet_light1);
      comet_light2 = new ForcePointLight('hsl(' + (comet_color_h - color_diff) + ', 60%, 50%)', 1, 500, 1);
      scene.add(comet_light2);
      camera.anchor = new THREE.Vector3(1500, 0, 0);
    },
    remove: function(scene) {
      comet.geometry.dispose();
      comet.material.dispose();
      scene.remove(comet);
      planet.geometry.dispose();
      planet.material.dispose();
      scene.remove(planet);
      points.geometry.dispose();
      points.material.dispose();
      scene.remove(points.obj);
      scene.remove(hemi_light);
      scene.remove(comet_light1);
      scene.remove(comet_light2);
      movers = [];
    },
    render: function(scene, camera) {
      accelerateComet();
      points.velocity = rotateComet();
      if (track_points === true) {
        camera.force.position.anchor.copy(
          points.velocity.clone().add(
            points.velocity.clone().sub(points.obj.position).normalize().multiplyScalar(-400)
          )
        );
        camera.force.position.anchor.y += points.velocity.y * 2;
        camera.force.look.anchor.copy(points.velocity);
      }
      points.updatePoints();
      comet.position.copy(points.velocity);
      hemi_light.color.setHSL((comet_color_h - color_diff - plus_acceleration / 1.5) / 360, 0.5, 0.6);
      hemi_light.groundColor.setHSL((comet_color_h + color_diff - plus_acceleration / 1.5) / 360, 0.5, 0.6);
      comet_light1.position.copy(points.velocity);
      comet_light1.color.setHSL((comet_color_h - color_diff - plus_acceleration / 1.5) / 360, 0.5, 0.6);
      comet_light2.position.copy(points.velocity);
      comet_light2.color.setHSL((comet_color_h + color_diff - plus_acceleration / 1.5) / 360, 0.5, 0.6);
      activateMover();
      updateMover();
      camera.force.position.applyHook(0, 0.025);
      camera.force.position.applyDrag(0.2);
      camera.force.position.updateVelocity();
      camera.updatePosition();
      camera.force.look.applyHook(0, 0.2);
      camera.force.look.applyDrag(0.4);
      camera.force.look.updateVelocity();
      camera.updateLook();
      rotateCometColor();
      bounceComet();
    },
    touchStart: function(scene, camera, vector) {
      is_touched = true;
      last_time_touch = Date.now();
    },
    touchMove: function(scene, camera, vector_mouse_down, vector_mouse_move) {
    },
    touchEnd: function(scene, camera, vector_mouse_end) {
      is_touched = false;
      if (Date.now() - last_time_touch < 100) {
        if (track_points === true) {
          camera.force.position.anchor.set(1200, 1200, 0);
          camera.force.look.anchor.set(0, 0, 0);
          track_points = false;
        } else {
          track_points = true;
        }
      }
    },
    mouseOut: function(scene, camera) {
      this.touchEnd(scene, camera)
    }
  };

  return Sketch;
};

module.exports = exports();

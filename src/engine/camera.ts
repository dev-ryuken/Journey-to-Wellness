import * as THREE from 'three';

/**
 * 2.5D Fixed-Angle Perspective Camera Controller
 * - ~52° downward tilt with smooth exponential damping follow
 * - Subtle pointer parallax (disabled cleanly when reduceMotion is active)
 * - Scripted cinematic sweep mode for the Ending Cutscene & Boss intro
 */
export class CameraRig25D {
  public readonly camera: THREE.PerspectiveCamera;
  private targetPos = new THREE.Vector3(0, 0, 6);
  private currentFocus = new THREE.Vector3(0, 0, 6);
  private parallaxOffset = new THREE.Vector2(0, 0);
  private desiredParallax = new THREE.Vector2(0, 0);
  private reduceMotion = false;

  // Base 52° perspective offset (Y height ~ 14.2, Z pullback ~ 11.1 => atan2(14.2, 11.1) ≈ 52°)
  private readonly baseOffset = new THREE.Vector3(0, 14.2, 11.2);
  private zoomFactor = 1.0;
  private cinematicMode: 'none' | 'ending_sweep' | 'boss_focus' = 'none';
  private cinematicTimer = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 160);
    this.camera.position.copy(this.currentFocus).add(this.baseOffset);
    this.camera.lookAt(this.currentFocus);
  }

  public setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public setReduceMotion(val: boolean) {
    this.reduceMotion = val;
    if (val) {
      this.parallaxOffset.set(0, 0);
      this.desiredParallax.set(0, 0);
    }
  }

  public setPointerNormalized(nx: number, ny: number) {
    if (this.reduceMotion) return;
    this.desiredParallax.set(
      THREE.MathUtils.clamp(nx, -1, 1) * 0.65,
      THREE.MathUtils.clamp(ny, -1, 1) * 0.35
    );
  }

  public setTarget(x: number, y: number, z: number, instant = false) {
    this.targetPos.set(x, y, z);
    if (instant) {
      this.currentFocus.copy(this.targetPos);
      this.camera.position.copy(this.currentFocus).add(this.baseOffset);
      this.camera.lookAt(this.currentFocus);
    }
  }

  public setZoom(factor: number) {
    this.zoomFactor = THREE.MathUtils.clamp(factor, 0.72, 1.35);
  }

  public startCinematic(mode: 'none' | 'ending_sweep' | 'boss_focus') {
    this.cinematicMode = mode;
    this.cinematicTimer = 0;
  }

  public update(delta: number) {
    const dt = Math.min(delta, 0.05);

    if (this.cinematicMode === 'ending_sweep') {
      this.cinematicTimer += dt;
      const angle = this.cinematicTimer * 0.28;
      const radius = 24;
      const focusX = Math.sin(angle * 0.5) * 6;
      const focusZ = -6 + Math.cos(angle * 0.5) * 6;
      this.currentFocus.x = THREE.MathUtils.damp(this.currentFocus.x, focusX, 3, dt);
      this.currentFocus.y = THREE.MathUtils.damp(this.currentFocus.y, 1.2, 3, dt);
      this.currentFocus.z = THREE.MathUtils.damp(this.currentFocus.z, focusZ, 3, dt);

      const camX = this.currentFocus.x + Math.sin(angle) * radius * 0.65;
      const camZ = this.currentFocus.z + Math.cos(angle) * radius * 0.65 + 8;
      const camY = 16.5 + Math.sin(this.cinematicTimer * 0.4) * 2.0;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 3, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camY, 3, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camZ, 3, dt);
      this.camera.lookAt(this.currentFocus);
      return;
    }

    if (this.cinematicMode === 'boss_focus') {
      this.currentFocus.x = THREE.MathUtils.damp(this.currentFocus.x, 0, 4, dt);
      this.currentFocus.y = THREE.MathUtils.damp(this.currentFocus.y, 2.5, 4, dt);
      this.currentFocus.z = THREE.MathUtils.damp(this.currentFocus.z, -35, 4, dt);

      const desiredX = this.currentFocus.x;
      const desiredY = this.currentFocus.y + 13.5;
      const desiredZ = this.currentFocus.z + 12.5;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, desiredX, 4, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, desiredY, 4, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, desiredZ, 4, dt);
      this.camera.lookAt(this.currentFocus);
      return;
    }

    // Standard 2.5D smooth damped follow
    const dampLambda = this.reduceMotion ? 16 : 6.5;
    this.currentFocus.x = THREE.MathUtils.damp(this.currentFocus.x, this.targetPos.x, dampLambda, dt);
    this.currentFocus.y = THREE.MathUtils.damp(this.currentFocus.y, this.targetPos.y + 0.8, dampLambda, dt);
    this.currentFocus.z = THREE.MathUtils.damp(this.currentFocus.z, this.targetPos.z, dampLambda, dt);

    if (!this.reduceMotion) {
      this.parallaxOffset.x = THREE.MathUtils.damp(this.parallaxOffset.x, this.desiredParallax.x, 4, dt);
      this.parallaxOffset.y = THREE.MathUtils.damp(this.parallaxOffset.y, this.desiredParallax.y, 4, dt);
    }

    const desiredCamX = this.currentFocus.x + this.baseOffset.x * this.zoomFactor + this.parallaxOffset.x;
    const desiredCamY = this.currentFocus.y + this.baseOffset.y * this.zoomFactor + this.parallaxOffset.y;
    const desiredCamZ = this.currentFocus.z + this.baseOffset.z * this.zoomFactor;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, desiredCamX, dampLambda, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, desiredCamY, dampLambda, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, desiredCamZ, dampLambda, dt);

    this.camera.lookAt(
      this.currentFocus.x + this.parallaxOffset.x * 0.25,
      this.currentFocus.y,
      this.currentFocus.z
    );
  }
}

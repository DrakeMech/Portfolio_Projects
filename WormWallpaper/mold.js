class Mold {
  updateHeadingTowardsCursor() {
    // Use gyroX and gyroY instead of mouseX and mouseY
    let targetAngle = atan2(gyroY - this.y, gyroX - this.x);
    let noiseValue = noise(this.x * 0.1, this.y * 0.1) * 300;
    targetAngle += radians(noiseValue);
    targetAngle = degrees(targetAngle);
  
    // Smoothly transition the heading towards the target angle
    let turnSpeed = 100; // Determines how quickly they adjust direction
    this.heading = lerp(this.heading, targetAngle, turnSpeed / 100);
  }
      
      constructor() {
      // Mold variables
      this.x = random(width);
      this.y = random(height); 
      // this.x = random(width/2 - 20, width/2 + 20);
      // this.y = random(height/2 - 20, height/2 + 20); 
      this.r = 0.5;
      
      this.heading = random(360);
      this.vx = cos(this.heading);
      this.vy = sin(this.heading);
      this.rotAngle = 270;
      this.stop = false // Boolean variable to stop molds from moving 
      this.speed = random(1, 100); // Each mold gets a random speed

      this.noiseOffset = random(1000); // Random offset for each mold to make the noise different



   
      
      // Sensor variables
      this.rSensorPos = createVector(0, 0);
      this.lSensorPos = createVector(0, 0);
      this.fSensorPos = createVector(0, 0);
      this.sensorAngle = 50;
      this.sensorDist = 2050;
      
    }
    
    update() {   
      // Using this.stop to control when molds stop moving
      if (this.stop) {
        this.vx = 0;
        this.vy = 0;
      } else {
        let noiseFactor = noise(this.noiseOffset) * 0.1; // Adjust for desired effect
  this.vx = cos(this.heading) * this.speed * noiseFactor;
  this.vy = sin(this.heading) * this.speed * noiseFactor;

  this.noiseOffset += 0.01;
      }
      
      // Using % Modulo expression to wrap around the canvas
      this.x = (this.x + this.vx + width) % width;
      this.y = (this.y + this.vy + height) % height;

      if (random(1) < 0.02) { // Adjust probability as needed
        this.heading += random(-45, 45); // Randomly adjust heading
      }
      
      // Get 3 sensor positions based on current position and heading
      this.getSensorPos(this.rSensorPos, this.heading + this.sensorAngle);
      this.getSensorPos(this.lSensorPos, this.heading - this.sensorAngle);
      this.getSensorPos(this.fSensorPos, this.heading);
    
      // Get indices of the 3 sensor positions and get the color values from those indices
      let index, l, r, f;
      index = 4*(d * floor(this.rSensorPos.y)) * (d * width) + 4*(d * floor(this.rSensorPos.x));
      r = pixels[index];
      
      index = 4*(d * floor(this.lSensorPos.y)) * (d * width) + 4*(d * floor(this.lSensorPos.x));
      l = pixels[index];
      
      index = 4*(d * floor(this.fSensorPos.y)) * (d * width) + 4*(d * floor(this.fSensorPos.x));
      f = pixels[index];
      
      // Compare values of f, l, and r to determine movement 
      if (f > l && f > r) {
        this.heading += 0;
      } else if (f < l && f < r) {
        if (random(1) < 0.5) {
          this.heading += this.rotAngle;
        } else {
          this.heading -= this.rotAngle;
        }
      } else if (l > r) {
        this.heading += -this.rotAngle;
      } else if (r > l) {
        this.heading += this.rotAngle;
      }
      
      
    }
    
    display() {
      noStroke();
      fill(255);
      ellipse(this.x, this.y, this.r*2, this.r*2);
      
      line(this.x, this.y, this.x + this.r*3*this.vx, this.y + this.r*3*this.vy);
      fill(255, 0, 0);
      // ellipse(this.rSensorPos.x, this.rSensorPos.y, this.r*2, this.r*2);
      // ellipse(this.lSensorPos.x, this.lSensorPos.y, this.r*2, this.r*2);
      // ellipse(this.fSensorPos.x, this.fSensorPos.y, this.r*2, this.r*2);
      
    }
    
    getSensorPos(sensor, angle) {
      sensor.x = (this.x + this.sensorDist*cos(angle) + width) % width;
      sensor.y = (this.y + this.sensorDist*sin(angle) + height) % height;
    }
  
  }
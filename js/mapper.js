/**
 * Mapper class.
 * @param {string} url - Image load url.
 * @param {string|Element} imgContainer - Image container ID or element itself.
 * @param {string|Element} drawContainer - GraphicsJS draw container or element.
 * @param {string|Element} zoomImgContainer - Image zoom container or element.
 * @param {string|Element} zoomDrawContainer - GraphicsJS zoom container or element.
 * @constructor
 */
Mapper = function(url, imgContainer, drawContainer, zoomImgContainer, zoomDrawContainer) {

  /**
   * @type {string}
   */
  this.imgUrl_ = url;

  /**
   * @type {Element}
   * @private
   */
  this.imgContainer_ = Mapper.isString(imgContainer) ? document.getElementById(imgContainer) : imgContainer;

  /**
   * @type {Element}
   * @private
   */
  this.drawContainer_ = Mapper.isString(drawContainer) ? document.getElementById(drawContainer) : drawContainer;

  /**
   * @type {Element}
   * @private
   */
  this.zoomImgContainer_ = Mapper.isString(zoomImgContainer) ? document.getElementById(zoomImgContainer) : zoomImgContainer;

  /**
   * @type {Element}
   * @private
   */
  this.zoomDrawContainer_ = Mapper.isString(zoomDrawContainer) ? document.getElementById(zoomDrawContainer) : zoomDrawContainer;

  /**
   * Calculated image width.
   * @type {number}
   */
  this.originalImageHeight = NaN;

  /**
   * Calculated image width.
   * @type {number}
   */
  this.originalImageWidth = NaN;

  /**
   * DOM image height.
   * @type {number}
   */
  this.domImageHeight = NaN;

  /**
   * DOM image width.
   * @type {number}
   */
  this.domImageWidth = NaN;

  /**
   * @type {*}
   */
  this.imgWrapper = $(this.imgContainer_);

  /**
   * @type {*}
   */
  this.drawWrapper = $(this.drawContainer_);

  /**
   * @type {*}
   */
  this.zoomImgWrapper = $(this.zoomImgContainer_);

  /**
   * @type {*}
   */
  this.zoomDrawWrapper = $(this.zoomDrawContainer_);

  /**
   *
   * @type {acgraph.vector.Stage}
   * @private
   */
  this.stage_ = null;

  /**
   *
   * @type {Array.<Object>}
   * @private
   */
  this.points_ = [];

  /**
   *
   * @type {Array.<acgraph.vector.Path>}
   * @private
   */
  this.pathPoints_ = [];

  /**
   *
   * @type {acgraph.vector.Layer}
   * @private
   */
  this.drawLayer_ = null;

  /**
   *
   * @type {acgraph.math.Rect}
   * @private
   */
  this.stageBounds_ = null;

  /**
   *
   * @type {acgraph.vector.Element}
   * @private
   */
  this.interactivityHandler_ = null;

  /**
   * Edit mode: adding points or scaling.
   * @type {boolean}
   * @private
   */
  this.addPoints_ = true;

  /**
   * Zooming mode. If dragging.
   * @type {boolean}
   * @private
   */
  this.zoomig_ = false;

};


/**
 * Returns true if the specified value is a string.
 * @param {*} val - Variable to test.
 * @return {boolean} - Whether variable is a string.
 */
Mapper.isString = function(val) {
  return typeof val == 'string';
};


/**
 * Map image load callback.
 * @param callback
 */
Mapper.prototype.load = function(callback) {
  var ths = this;
  var img = $('<img style="width: 100%"/>');
  ths.imgWrapper.append(img);
  //863 x 593
  img.one('load', function() {
    ths.originalImageHeight = this.naturalHeight;
    ths.originalImageWidth = this.naturalWidth;

    ths.domImageHeight = this.height;
    ths.domImageWidth = this.width;

    ths.imgWrapper.parent().css('height', this.height);
    ths.zoomImgWrapper.parent().css('height', this.height);

    ths.initGraphics_();
  });
  img.attr('src', ths.imgUrl_);

  callback(); //no need to use callback.call() here.
};


Mapper.prototype.addPoints = function(val) {
  this.addPoints_ = val;
};

Mapper.prototype.initGraphics_ = function() {
  this.stage_ = acgraph.create(this.drawContainer_);
  this.stageBounds_ = this.stage_.getBounds();
  this.drawLayer_ = this.stage_.layer();
  this.interactivityHandler_ = this.drawLayer_.rect(this.stageBounds_.left, this.stageBounds_.top, this.stageBounds_.width, this.stageBounds_.height);
  this.interactivityHandler_.fill({color:'#fff', opacity: 0.00001});
  this.interactivityHandler_.zIndex(-1e10);
  this.interactivityHandler_.listen('click', this.clickListener_, false, this);
  this.interactivityHandler_.listen('mousedown', this.mouseDownListener_, false, this);
  this.interactivityHandler_.listen('mouseup', this.mouseUpListener_, false, this);
  this.interactivityHandler_.listen('mousemove', this.mouseMoveListener_, false, this);

  this.zoomingPath_ = this.drawLayer_.path();
  this.zoomingPath_.disablePointerEvents(true);
  this.zoomingPath_.stroke({dash: '3 2', color: 'blue'});
  this.zoomingPath_.zIndex(1e10);

  this.previewContour_ = this.drawLayer_.path();
  this.previewContour_.stroke({dash: '5 3', color: 'red'});
  this.previewContour_.zIndex(-10);
};

Mapper.prototype.clickListener_ = function(e) {
  if (this.addPoints_) { //Adding points
    var xRatio = e.offsetX / this.stageBounds_.width;
    var yRatio = e.offsetY / this.stageBounds_.height;
    var pointsData = {
      pointIndex: this.points_.length,
      xRatio: xRatio,
      yRatio: yRatio,
      originalX: Math.round(xRatio * this.originalImageWidth),
      originalY: Math.round(yRatio * this.originalImageHeight),
      scaledX: e.offsetX,
      scaledY: e.offsetY
    };
    this.points_.push(pointsData);

    var path = this.drawLayer_.path();
    path.fill('yellow');
    acgraph.vector.primitives.diamond(path, e.offsetX, e.offsetY, 5);
    this.pathPoints_.push(path);
    this.refreshPreview_();
  } else {
    //console.log('ZOOMING CLICK');
  }
};


Mapper.prototype.mouseDownListener_ = function(e) {
  if (!this.addPoints_) { //Zooming
    this.zooming_ = true;
    this.startX_ = e.offsetX;
    this.startY_ = e.offsetY;
    this.zoomingPath_.parent(this.drawLayer_);
    this.zoomingPath_.clear();
    this.zoomingPath_.zIndex(1e10);
    document.body.style.cursor = 'crosshair';
  }
};


Mapper.prototype.mouseUpListener_ = function(e) {
  if (!this.addPoints_) { //Zooming
    this.zooming_ = false;

    var minX = Math.min(this.startX_, e.offsetX);
    var minY = Math.min(this.startY_, e.offsetY);
    var maxX = Math.max(this.startX_, e.offsetX);
    var maxY = Math.max(this.startY_, e.offsetY);

    var widthRatio = (maxX - minX) / this.stageBounds_.width;
    var heightRatio = (maxY - minY) / this.stageBounds_.height;

    var leftRatio = minX / this.stageBounds_.width;
    var topRatio = minY / this.stageBounds_.height;

    var zoomImageWrapperWidth = this.zoomImgWrapper.width();
    var zoomImageWrapperHeight = this.zoomImgWrapper.height();

    var zoomImgWidth = Math.round(zoomImageWrapperWidth / widthRatio);
    var rat = zoomImgWidth / this.domImageWidth;

    // var zoomImgHeight = Math.round(this.originalImageHeight / widthRatio); //Yes, here we divide on widthRatio to save image proportions.
    var zoomImgHeight = Math.round(this.originalImageHeight * rat);
    var zoomImgLeftOffset = -leftRatio * zoomImgWidth;

    var zoomImgTopOffset = -topRatio * zoomImgHeight;

    this.zoomImgWrapper.empty();
    var newZoomImg = $('<img/>');
    newZoomImg
        .attr('src', this.imgUrl_)
        .css('width', zoomImgWidth + 'px')
        .css('height', zoomImgHeight + 'px')
        .css('margin-left', zoomImgLeftOffset + 'px')
        .css('margin-top', zoomImgTopOffset + 'px');

    this.zoomImgWrapper.append(newZoomImg);

    this.zoomingPath_.remove();
    this.zoomingPath_.clear();
    this.startX_ = NaN;
    this.startY_ = NaN;
    document.body.style.cursor = 'auto';
  }
};


Mapper.prototype.mouseMoveListener_ = function(e) {
  if (!this.addPoints_) { //Zooming

    if (this.zooming_) {
      this.zoomingPath_.clear();
      this.zoomingPath_
          .moveTo(this.startX_, this.startY_)
          .lineTo(this.startX_, e.offsetY)
          .lineTo(e.offsetX, e.offsetY)
          .lineTo(e.offsetX, this.startY_)
          .close();
    }
  }
};


Mapper.prototype.refreshPreview_ = function() {
  this.previewContour_.clear();
  for (var i = 0; i < this.points_.length; i++) {
    var point = this.points_[i];
    var left = this.stageBounds_.width * point.xRatio;
    var top = this.stageBounds_.height * point.yRatio;
    if (i == 0) {
      this.previewContour_.moveTo(left, top);
    } else {
      this.previewContour_.lineTo(left, top);
    }
  }
  if (this.points_.length > 2)
    this.previewContour_.close();
};




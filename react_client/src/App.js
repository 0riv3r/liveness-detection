import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import AWS from "aws-sdk";

import { drawRect } from "./draw_rect";

const videoConstraints = {
  width: 540, //720,
  height: 360,
  facingMode: "user",
};

/*
https://create-react-app.dev/docs/adding-custom-environment-variables/
https://create-react-app.dev/docs/adding-custom-environment-variables/#adding-development-environment-variables-in-env
https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html
*/
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN,
  region: process.env.REACT_APP_AWS_REGION
});
//console.log(`AWS.config.accessKeyId: ${AWS.config.credentials?.accessKeyId}`);
console.log(`AWS.config.region: ${AWS.config.region}`);

const rekognitionClient = new AWS.Rekognition({
  apiVersion: "2016-06-27",
});

// Face analysis by Amazon Rekognition
const detectFaces = async (imageData) => {
  const params = {
    Image: {
      Bytes: Buffer.from(
        imageData.replace("data:image/jpeg;base64,", ""),
        "base64"
      ),
    },
    Attributes: ["ALL"],
  };
  return await rekognitionClient.detectFaces(params).promise();
};

const getNumberOfPeople = (rekognizeResult) => {
  return rekognizeResult.FaceDetails.length;
};

// Analysis results: Confidence level
const getConfidence = (rekognizeResult) => {
    return rekognizeResult.FaceDetails[0].Confidence;
};

// Analysis results: Pose
const getPose = (rekognizeResult) => {

  const pitch = rekognizeResult.FaceDetails[0].Pose.Pitch;
  const roll = rekognizeResult.FaceDetails[0].Pose.Roll;
  const yaw = rekognizeResult.FaceDetails[0].Pose.Yaw;

  return {pitch, roll, yaw};
};

// Analysis results: Eyeglasses
const getIsWearingEyeGlasses = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].Eyeglasses.Value;
};

// Analysis results: Sunglasses
const getIsWearingSunGlasses = (rekognizeResult) => {
  return rekognizeResult.FaceDetails[0].Sunglasses.Value;
};

// Analysis results: Smile
const getIsSmile = (rekognizeResult) => {
  return rekognizeResult.FaceDetails[0].Smile.Value;
};

const getChinBottom = (rekognizeResult) => {
  // rekognizeResult.FaceDetails[0].Landmarks[27].Type ==> "chinBottom"
  const x = rekognizeResult.FaceDetails[0].Landmarks[27].X,
        y = rekognizeResult.FaceDetails[0].Landmarks[27].Y;
  return {x,y};
};

// Analysis results: Left Eye
const getEyeLeft = (rekognizeResult) => {
  const x = rekognizeResult.FaceDetails[0].Landmarks[0].X,
        y = rekognizeResult.FaceDetails[0].Landmarks[0].Y;

  return {x,y};
};

const App = () => {

  let now = new Date();
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [url, setUrl] = useState(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setUrl(imageSrc);
      setRekognizeResult(undefined);
    }
  }, [webcamRef]);

  const [rekognizeResult, setRekognizeResult] = useState();
  const rekognizeHandler = async () => {
    const result = await detectFaces(url);
    setRekognizeResult(result);
    console.log(result);
  };

  const getRealFaceRectBoundaries = (rekognizeResult) => {

    const x_offset = -35;// -180;
    const y_offset = 5;
    const face_bounding_box = rekognizeResult.FaceDetails[0].BoundingBox;
    /*
    BoundingBox:
    Height: 0.41345128417015076
    Left: 0.39006850123405457
    Top: 0.19800728559494019
    Width: 0.13521090149879456
    */

    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    const x = face_bounding_box.Left * videoWidth + x_offset;
    const y = face_bounding_box.Top * videoHeight + y_offset;
    const width = face_bounding_box.Width * videoWidth;
    const height = face_bounding_box.Height * videoHeight;
    const right = x + width;
    const bottom = y + height;

    const color = 'purple'

    return {x, y, width, height, right, bottom, color};
  }

  const getFaceBoundariesConstraints = (rekognizeResult) => {
    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    let color = 'red'

    const x_offset = -10;
    const y_offset = -20;
    const with_offset = 10;
    const height_offset = 40;


    const x = (videoWidth / 4) + x_offset;
    const y = (videoHeight / 4) + y_offset;
    const width = (videoWidth / 3) + with_offset;
    const height = (videoHeight / 2) + height_offset;

    const right = x + width;
    const bottom = y + height;

    const diff_offset = 5;

    if( getRealFaceRectBoundaries(rekognizeResult).x - diff_offset > x &&
        getRealFaceRectBoundaries(rekognizeResult).y - diff_offset > y &&
        getRealFaceRectBoundaries(rekognizeResult).right + diff_offset < right &&
        getRealFaceRectBoundaries(rekognizeResult).bottom + diff_offset < bottom ){
          color = 'green'
        }

    return{x, y, width,height, color};
  }

  const getChinRect = (rekognizeResult) => {
    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    const x_offset = -55;
    const y_offset = -15;

    // Chin boundary
    const x = (getChinBottom(rekognizeResult).x  * videoWidth) + x_offset;
    const y = (getChinBottom(rekognizeResult).y  * videoHeight) + y_offset;
    const width = 40;
    const height = 20; 
    const color = 'yellow'

    return{x, y, width,height, color};
  }

  const drawAllRects = (rekognizeResult) => {
    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    // Set canvas height and width
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;
    const ctx = canvasRef.current.getContext("2d");

    let rects = [];
    // Real face rect
    rects.push(getRealFaceRectBoundaries(rekognizeResult))
    // Face boundary constraints
    rects.push(getFaceBoundariesConstraints(rekognizeResult))
    // Chin boundary rect
    rects.push(getChinRect(rekognizeResult))

    drawRect(rects, ctx);
  }

  return (
    <div className="App">
      <header className="header">
        <h1>Liveness Detection</h1>
      </header>       
      {(
      <>
        <div className="webcam">
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              marginLeft: "auto",
              marginRight: "auto",
              left: 0,
              right: 0,
              textAlign: "center",
              zindex: 8,
              width: 540,
              height: 360,
              // width: 640,
              // height: 480,
            }}
          />
          <Webcam
            audio={false}
            width={540}
            height={360}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
          />
        </div>
        <button onClick={capture}>Capture!</button>
      </>
      )}
      {url && (
        <>
          {/* <div>{rekognizeHandler()}</div> */}
          {/* <div>{setUrl(undefined)}</div> */}
          {/* <div>
            {
              setInterval(function() {
                rekognizeHandler()
              }, 10000)
            }
          </div> */}
          <div>
            <button onClick={() => rekognizeHandler()}>Analyze</button>
          </div>
          {/* <div>
            <img src={url} alt="Screenshot" />
          </div> */}
          {typeof rekognizeResult !== "undefined" && (
            <div className="rekognizeResult">
              <div>{"Number of People: " + getNumberOfPeople(rekognizeResult)}</div>
              <div>{"Confidence: " + getConfidence(rekognizeResult)}</div>
              <div>
                {"Now: " +
                now.getMinutes() + ":" + 
                now.getSeconds()}
              </div>
              <div>
                {"Pose: " +
                  getPose(rekognizeResult).pitch +
                  ", " +
                  getPose(rekognizeResult).roll + 
                  ", " +
                  getPose(rekognizeResult).yaw}
              </div>
              <div>
                {"Eyeglasses: " + getIsWearingEyeGlasses(rekognizeResult)}
              </div>
              <div>
                {"Sunglasses: " + getIsWearingSunGlasses(rekognizeResult)}
              </div>
              <div>
                {"Smile: " + getIsSmile(rekognizeResult)}
              </div>
              <div>
                {"Left eye: " + 
                  getEyeLeft(rekognizeResult).x + 
                  ", " +
                  getEyeLeft(rekognizeResult).y}
              </div>
              <div>
                {drawAllRects(rekognizeResult)}
              </div>
              {/* <div>
                {setFaceRectBoundaries(getFaceBoundingBox(rekognizeResult).Left, 
                      getFaceBoundingBox(rekognizeResult).Top,
                      getFaceBoundingBox(rekognizeResult).Width,
                      getFaceBoundingBox(rekognizeResult).Height)}
              </div> */}
              {/* <div>
                {rect(getEyeLeft(rekognizeResult).x, 
                      getEyeLeft(rekognizeResult).y)}
              </div>
              <div>
                {rect(getChinBottom(rekognizeResult).x, 
                      getChinBottom(rekognizeResult).y)}
              </div> */}
              <button onClick={capture}>Capture!</button>
              {/* {capture()} */}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;
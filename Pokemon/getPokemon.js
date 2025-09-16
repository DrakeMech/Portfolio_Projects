// Define the URL and options for the API request
const url = "https://pokeapi.co/api/v2/pokemon";
const options = {
  method: "GET",
};

// Define an asynchronous function for making JSON requests
async function JSONRequest() {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Error , Status: ${response.status}`);
    }
    const data = await response.json();
    if (data && data.results) {
      return data.results;
    } else {
      throw new Error("Unable to find results in the API response");
    }
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
}

// Define settings and state for the application
const settings = {
  resultEl: document.querySelector('#pokemonEl'),
  buttonEl: document.querySelector('#random-button'),
  imageEl:  document.querySelector('#imageEl'),
  catchEl:  document.querySelector('#catch-button'),
  catchResult: document.querySelector('#catch'),
};

let state = {
  catching: 0,
}

// Function to update the application state
function updateState(s) {
  state = Object.freeze({ ...state, ...s });
}

// Function to generate a random index
function randomIndex(value) {
  return Math.floor(Math.random() * value);
}

// Calling the JSONRequest
JSONRequest()
  .then((results) => {
    const { resultEl, buttonEl, catchResult, imageEl } = settings;
    // Check if there is at least one result
    if (results.length > 0) {
      // Add click event listener to the button
      buttonEl.addEventListener('click', () => {
        //initializes a random number of the lenght of the array results
        const newRandomPokemonIndex = randomIndex(results.length);
        //initializes the constant that receives the property of the object withing results array
        const newRandomPokemonName = results[newRandomPokemonIndex].name;
        //empties the inner text of the results
        catchResult.innerText = "";
        //inserts the uppercassed name of the pokemon 
        resultEl.innerText = newRandomPokemonName.substring(0, 1).toUpperCase() + newRandomPokemonName.substring(1);
        // Set the image source based on the random Pokemon index
        imageEl.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/${newRandomPokemonIndex+1}.svg`
      });
    } else {
      //gives an error whenever there is no results to the array
      console.error("No Pokemon found in the results");
    }
  })
  .catch((error) => {
    //An error is being called whenever there is an error with the request
    console.error("Error:", error.message);
});

// Function to add a catching animation
function animation(){
  const { imageEl } = settings;
  imageEl.classList.add('catch');
  setTimeout(() => {
    imageEl.classList.remove('catch');
  }, 4800);
}

// Function to handle the catching process
function catchCall(){
  const { resultEl, imageEl, catchResult } = settings;
  if(resultEl.innerText !== "" && imageEl.src != `https://i.pinimg.com/564x/f8/33/5a/f8335abfc56c2a665ca700c0c24a68a5.jpg`){
    animation();
    setTimeout(() => {
      if (randomIndex(2)) {
        console.log("Congrats You've Catched It!");
        catchResult.innerText = "Congrats! You've catched the Pokemon. You can search for a new one now";
        // Set the image source to a success image
        imageEl.src = `https://i.pinimg.com/564x/f8/33/5a/f8335abfc56c2a665ca700c0c24a68a5.jpg`;
      } else {
        console.log("Failed!");
        catchResult.innerText = "Oh noo! The Pokemon escaped. Try to catch it again!"
      }
      updateState({
        catching : 0,
      });
    }, 5000);
  }
}

// Function to set up event listeners
function setup() {
  const { catchEl } = settings;
  let { catching } = state;
  // Catch animation event listener
  if(catching === 0)
    catchEl.addEventListener('click', () => {
      updateState({
        catching : 1,
      });
      //call of the catchCall function
      catchCall();
    });
}
function loop(){
  requestAnimationFrame(loop);
}
// loop();
setup();

// Exported catchCall function for microcontroller.js
export { catchCall };

-- =============================================================================
-- Built-in recipe catalog (household_id = NULL => visible to all users).
-- Ingredient keys are normalized singular nouns that inventory products are
-- matched against (see src/lib/domain/recipes.ts).
-- Ingredient tuple: [key, display name, quantity|null, unit|null, optional?]
-- =============================================================================

create or replace function pg_temp.add_recipe(
  p_slug text, p_name text, p_description text, p_icon text, p_cuisine text,
  p_prep int, p_cook int, p_servings int, p_difficulty public.recipe_difficulty,
  p_diets text[], p_steps text[], p_ingredients jsonb
) returns void
language plpgsql
as $$
declare
  rid uuid;
  ing jsonb;
  pos int := 0;
begin
  insert into public.recipes (household_id, slug, name, description, icon, cuisine, prep_minutes, cook_minutes, servings, difficulty, diets, instructions)
  values (null, p_slug, p_name, p_description, p_icon, p_cuisine, p_prep, p_cook, p_servings, p_difficulty, p_diets, p_steps)
  returning id into rid;
  for ing in select * from jsonb_array_elements(p_ingredients) loop
    pos := pos + 1;
    insert into public.recipe_ingredients (recipe_id, position, ingredient_key, display_name, quantity, unit, optional)
    values (rid, pos, ing ->> 0, ing ->> 1, (ing ->> 2)::numeric, ing ->> 3, coalesce((ing ->> 4)::boolean, false));
  end loop;
end;
$$;

select pg_temp.add_recipe('masala-omelette', 'Masala Omelette',
  'A fluffy spiced omelette with onion, tomato and green chilli.', 'egg', 'Indian', 5, 5, 1, 'easy',
  array['vegetarian', 'gluten-free'],
  array['Finely chop the onion, tomato and chilli.',
        'Whisk the eggs with salt and turmeric, then stir in the vegetables.',
        'Heat oil in a pan, pour in the egg mixture and cook on medium heat until set.',
        'Fold, cook for another minute and serve hot.'],
  '[["egg","Eggs",2,"pcs"],["onion","Onion",50,"g"],["tomato","Tomato",50,"g"],["green chilli","Green chilli",1,"pcs",true],["turmeric","Turmeric powder",0.25,"tsp"],["salt","Salt",null,null],["cooking oil","Cooking oil",1,"tbsp"]]');

select pg_temp.add_recipe('tomato-garlic-spaghetti', 'Tomato Garlic Spaghetti',
  'Simple weeknight pasta with fresh tomatoes, garlic and olive oil.', 'utensils', 'Italian', 10, 15, 2, 'easy',
  array['vegetarian', 'vegan'],
  array['Boil the spaghetti in salted water until al dente.',
        'Meanwhile, warm olive oil and gently cook sliced garlic until fragrant.',
        'Add chopped tomatoes and a pinch of salt; simmer for 8 minutes.',
        'Toss the drained pasta with the sauce and serve.'],
  '[["pasta","Spaghetti",200,"g"],["tomato","Tomatoes",300,"g"],["garlic","Garlic",10,"g"],["olive oil","Olive oil",2,"tbsp"],["salt","Salt",null,null],["basil","Fresh basil",1,"bunch",true]]');

select pg_temp.add_recipe('dal-tadka', 'Dal Tadka',
  'Comforting yellow lentils finished with a sizzling cumin and garlic tempering.', 'soup', 'Indian', 10, 30, 4, 'easy',
  array['vegetarian', 'vegan', 'gluten-free'],
  array['Rinse the dal and pressure cook with turmeric, salt and 3 cups of water until soft.',
        'Heat oil, add cumin seeds, then garlic, onion and tomato; cook until soft.',
        'Pour the tempering over the dal, simmer for 5 minutes and adjust salt.',
        'Finish with lemon juice and serve with rice or roti.'],
  '[["toor dal","Toor dal",200,"g"],["onion","Onion",100,"g"],["tomato","Tomato",100,"g"],["garlic","Garlic",10,"g"],["cumin","Cumin seeds",1,"tsp"],["turmeric","Turmeric powder",0.5,"tsp"],["cooking oil","Cooking oil",2,"tbsp"],["salt","Salt",null,null],["lemon","Lemon",1,"pcs",true]]');

select pg_temp.add_recipe('jeera-rice', 'Jeera Rice',
  'Fragrant basmati rice tempered with cumin.', 'wheat', 'Indian', 5, 20, 3, 'easy',
  array['vegetarian', 'vegan', 'gluten-free'],
  array['Rinse and soak the rice for 15 minutes.',
        'Heat oil or butter, add cumin seeds and let them sizzle.',
        'Add the drained rice, 2 cups of water and salt; bring to a boil.',
        'Cover and cook on low heat for 12 minutes, then rest for 5 minutes.'],
  '[["rice","Basmati rice",200,"g"],["cumin","Cumin seeds",1,"tsp"],["cooking oil","Oil or ghee",1,"tbsp"],["salt","Salt",null,null]]');

select pg_temp.add_recipe('vegetable-fried-rice', 'Vegetable Fried Rice',
  'Quick fried rice with peas, onion and egg.', 'cooking-pot', 'Chinese', 10, 10, 2, 'easy',
  array['vegetarian'],
  array['Cook the rice and let it cool completely (leftover rice works best).',
        'Scramble the eggs in a hot wok and set aside.',
        'Stir-fry onion, garlic and peas in oil for 3 minutes.',
        'Add the rice, soy sauce and eggs; toss on high heat for 2 minutes.'],
  '[["rice","Rice",200,"g"],["egg","Eggs",2,"pcs"],["peas","Peas",100,"g"],["onion","Onion",75,"g"],["garlic","Garlic",5,"g"],["soy sauce","Soy sauce",2,"tbsp"],["cooking oil","Cooking oil",2,"tbsp"]]');

select pg_temp.add_recipe('aloo-sabzi', 'Aloo Sabzi',
  'Dry-spiced potatoes with cumin and turmeric.', 'carrot', 'Indian', 10, 20, 3, 'easy',
  array['vegetarian', 'vegan', 'gluten-free'],
  array['Boil, peel and cube the potatoes.',
        'Heat oil, add cumin seeds, then onion; cook until golden.',
        'Add turmeric, salt and potatoes; toss and cook for 8 minutes until crisp at the edges.',
        'Finish with lemon juice.'],
  '[["potato","Potatoes",500,"g"],["onion","Onion",100,"g"],["cumin","Cumin seeds",1,"tsp"],["turmeric","Turmeric powder",0.5,"tsp"],["cooking oil","Cooking oil",2,"tbsp"],["salt","Salt",null,null],["lemon","Lemon",1,"pcs",true]]');

select pg_temp.add_recipe('overnight-oats', 'Overnight Oats',
  'No-cook breakfast oats with banana and honey.', 'coffee', 'International', 5, 0, 1, 'easy',
  array['vegetarian'],
  array['Combine oats and milk in a jar.',
        'Stir in honey and top with sliced banana.',
        'Cover and refrigerate overnight. Eat cold or warmed.'],
  '[["oats","Rolled oats",50,"g"],["milk","Milk",150,"ml"],["banana","Banana",1,"pcs"],["honey","Honey",1,"tbsp",true]]');

select pg_temp.add_recipe('banana-smoothie', 'Banana Honey Smoothie',
  'Creamy banana smoothie ready in two minutes.', 'cup-soda', 'International', 5, 0, 1, 'easy',
  array['vegetarian', 'gluten-free'],
  array['Add banana, milk and honey to a blender.',
        'Blend until smooth and serve immediately.'],
  '[["banana","Bananas",2,"pcs"],["milk","Milk",250,"ml"],["honey","Honey",1,"tbsp",true],["oats","Rolled oats",2,"tbsp",true]]');

select pg_temp.add_recipe('french-toast', 'French Toast',
  'Golden egg-dipped bread with honey.', 'croissant', 'International', 5, 10, 2, 'easy',
  array['vegetarian'],
  array['Whisk eggs and milk with a pinch of salt.',
        'Dip each slice of bread in the mixture.',
        'Cook in butter on medium heat until golden on both sides.',
        'Drizzle with honey and serve.'],
  '[["bread","Bread",1,"loaf"],["egg","Eggs",2,"pcs"],["milk","Milk",100,"ml"],["butter","Butter",20,"g"],["honey","Honey",1,"tbsp",true]]');

select pg_temp.add_recipe('scrambled-eggs-toast', 'Scrambled Eggs on Toast',
  'Soft, buttery scrambled eggs on toast.', 'egg', 'International', 2, 5, 1, 'easy',
  array['vegetarian'],
  array['Whisk eggs with a pinch of salt.',
        'Melt butter on low heat and add the eggs, stirring gently until just set.',
        'Serve on toasted bread.'],
  '[["egg","Eggs",3,"pcs"],["butter","Butter",10,"g"],["bread","Bread",1,"loaf"],["salt","Salt",null,null]]');

select pg_temp.add_recipe('paneer-bhurji', 'Paneer Bhurji',
  'Crumbled paneer cooked with onion, tomato and spices.', 'cooking-pot', 'Indian', 10, 10, 2, 'easy',
  array['vegetarian', 'gluten-free'],
  array['Crumble the paneer.',
        'Heat oil, add cumin, then onion; cook until soft.',
        'Add tomato, turmeric and salt; cook until jammy.',
        'Stir in the paneer and cook for 3 minutes.'],
  '[["paneer","Paneer",200,"g"],["onion","Onion",75,"g"],["tomato","Tomato",100,"g"],["cumin","Cumin seeds",0.5,"tsp"],["turmeric","Turmeric powder",0.25,"tsp"],["cooking oil","Cooking oil",1,"tbsp"],["salt","Salt",null,null]]');

select pg_temp.add_recipe('lemon-rice', 'Lemon Rice',
  'Tangy South Indian rice with turmeric and peanuts.', 'citrus', 'Indian', 10, 10, 3, 'easy',
  array['vegetarian', 'vegan', 'gluten-free'],
  array['Cook the rice and spread it out to cool.',
        'Temper mustard seeds, peanuts and curry leaves in oil.',
        'Add turmeric and salt, then the rice.',
        'Turn off the heat and mix in lemon juice.'],
  '[["rice","Rice",200,"g"],["lemon","Lemons",2,"pcs"],["turmeric","Turmeric powder",0.5,"tsp"],["peanut","Peanuts",30,"g",true],["mustard seed","Mustard seeds",1,"tsp",true],["cooking oil","Cooking oil",2,"tbsp"],["salt","Salt",null,null]]');

select pg_temp.add_recipe('poha', 'Kanda Poha',
  'Flattened rice with onion, peanuts and lemon.', 'leaf', 'Indian', 10, 10, 2, 'easy',
  array['vegetarian', 'vegan', 'gluten-free'],
  array['Rinse the poha and let it soften for 5 minutes.',
        'Temper mustard seeds and peanuts in oil, then add onion.',
        'Add turmeric, salt and poha; mix gently and steam for 3 minutes.',
        'Finish with lemon juice.'],
  '[["poha","Poha (flattened rice)",150,"g"],["onion","Onion",75,"g"],["peanut","Peanuts",30,"g",true],["turmeric","Turmeric powder",0.5,"tsp"],["cooking oil","Cooking oil",1,"tbsp"],["lemon","Lemon",1,"pcs"],["salt","Salt",null,null]]');

select pg_temp.add_recipe('chapati', 'Whole Wheat Chapati',
  'Soft everyday flatbread.', 'wheat', 'Indian', 15, 15, 4, 'medium',
  array['vegetarian', 'vegan'],
  array['Mix flour with salt and gradually add water to form a soft dough.',
        'Rest the dough for 15 minutes, then divide into balls.',
        'Roll out thinly and cook on a hot tawa until puffed and spotted.'],
  '[["wheat flour","Whole wheat flour",250,"g"],["salt","Salt",null,null],["cooking oil","Oil",1,"tsp",true]]');

select pg_temp.add_recipe('greek-salad', 'Greek Salad',
  'Crunchy salad with tomato, cucumber, onion and feta.', 'salad', 'Greek', 10, 0, 2, 'easy',
  array['vegetarian', 'gluten-free'],
  array['Chop tomatoes, cucumber and onion into chunks.',
        'Add olives and crumbled feta.',
        'Dress with olive oil, lemon juice and salt.'],
  '[["tomato","Tomatoes",300,"g"],["cucumber","Cucumber",1,"pcs"],["onion","Red onion",50,"g"],["feta","Feta cheese",100,"g"],["olive","Olives",50,"g",true],["olive oil","Olive oil",2,"tbsp"],["lemon","Lemon",1,"pcs",true]]');

select pg_temp.add_recipe('guacamole', 'Guacamole',
  'Fresh avocado dip with lime, onion and tomato.', 'salad', 'Mexican', 10, 0, 4, 'easy',
  array['vegetarian', 'vegan', 'gluten-free'],
  array['Mash the avocados.',
        'Fold in finely chopped onion, tomato and coriander.',
        'Season with lime juice and salt.'],
  '[["avocado","Avocados",2,"pcs"],["lime","Lime",1,"pcs"],["onion","Onion",30,"g"],["tomato","Tomato",75,"g",true],["coriander","Coriander",1,"bunch",true],["salt","Salt",null,null]]');

select pg_temp.add_recipe('grilled-cheese', 'Grilled Cheese Sandwich',
  'Crisp, buttery sandwich with melted cheese.', 'sandwich', 'American', 3, 6, 1, 'easy',
  array['vegetarian'],
  array['Butter one side of each bread slice.',
        'Place cheese between the unbuttered sides.',
        'Cook in a pan on medium-low heat until golden and melted.'],
  '[["bread","Bread",1,"loaf"],["cheese","Cheese",50,"g"],["butter","Butter",15,"g"]]');

select pg_temp.add_recipe('banana-pancakes', 'Banana Pancakes',
  'Fluffy pancakes sweetened with ripe banana.', 'cake-slice', 'American', 10, 15, 2, 'medium',
  array['vegetarian'],
  array['Mash the banana and whisk with egg and milk.',
        'Fold in flour, baking powder and a pinch of salt.',
        'Cook spoonfuls on a buttered pan until bubbles form, then flip.',
        'Serve with honey.'],
  '[["all purpose flour","All-purpose flour",150,"g"],["banana","Banana",1,"pcs"],["egg","Egg",1,"pcs"],["milk","Milk",200,"ml"],["baking powder","Baking powder",2,"tsp"],["butter","Butter",20,"g"],["honey","Honey",2,"tbsp",true]]');

select pg_temp.add_recipe('chana-masala', 'Chana Masala',
  'Hearty chickpea curry in a spiced tomato-onion gravy.', 'soup', 'Indian', 10, 30, 4, 'medium',
  array['vegetarian', 'vegan', 'gluten-free'],
  array['Soak chickpeas overnight and pressure cook until tender (or use canned).',
        'Cook onion, garlic and ginger in oil until golden.',
        'Add tomatoes, turmeric, cumin and garam masala; cook until oil separates.',
        'Add chickpeas with some cooking water; simmer for 15 minutes.'],
  '[["chickpea","Chickpeas",250,"g"],["onion","Onion",150,"g"],["tomato","Tomatoes",200,"g"],["garlic","Garlic",10,"g"],["ginger","Ginger",10,"g",true],["cumin","Cumin seeds",1,"tsp"],["turmeric","Turmeric powder",0.5,"tsp"],["garam masala","Garam masala",1,"tsp"],["cooking oil","Cooking oil",3,"tbsp"],["salt","Salt",null,null]]');

select pg_temp.add_recipe('chicken-curry', 'Home-style Chicken Curry',
  'Everyday chicken curry with onion, tomato and warm spices.', 'beef', 'Indian', 15, 35, 4, 'medium',
  array['gluten-free'],
  array['Brown onions in oil, then add garlic and ginger.',
        'Add tomatoes and spices; cook until the masala thickens.',
        'Add chicken and cook, covered, for 25 minutes.',
        'Adjust salt and finish with coriander.'],
  '[["chicken","Chicken",500,"g"],["onion","Onion",200,"g"],["tomato","Tomatoes",200,"g"],["garlic","Garlic",15,"g"],["ginger","Ginger",15,"g"],["turmeric","Turmeric powder",0.5,"tsp"],["garam masala","Garam masala",1,"tsp"],["cooking oil","Cooking oil",3,"tbsp"],["salt","Salt",null,null],["coriander","Coriander",1,"bunch",true]]');

select pg_temp.add_recipe('vegetable-upma', 'Vegetable Upma',
  'Savory semolina porridge with vegetables.', 'cooking-pot', 'Indian', 10, 15, 2, 'easy',
  array['vegetarian', 'vegan'],
  array['Dry roast the semolina until fragrant and set aside.',
        'Temper mustard seeds in oil, add onion and peas.',
        'Add 2 cups of water and salt; bring to a boil.',
        'Stream in the semolina while stirring and cook until thick.'],
  '[["semolina","Semolina (rava)",150,"g"],["onion","Onion",75,"g"],["peas","Peas",50,"g",true],["mustard seed","Mustard seeds",1,"tsp",true],["cooking oil","Cooking oil",2,"tbsp"],["salt","Salt",null,null]]');

select pg_temp.add_recipe('mushroom-risotto', 'Mushroom Risotto',
  'Creamy risotto with mushrooms and parmesan.', 'cooking-pot', 'Italian', 10, 30, 2, 'hard',
  array['vegetarian', 'gluten-free'],
  array['Sauté onion and garlic in butter, then add sliced mushrooms.',
        'Add arborio rice and toast for 2 minutes.',
        'Add hot stock a ladle at a time, stirring, for about 20 minutes.',
        'Finish with butter and parmesan; season to taste.'],
  '[["arborio rice","Arborio rice",160,"g"],["mushroom","Mushrooms",200,"g"],["onion","Onion",75,"g"],["garlic","Garlic",5,"g"],["butter","Butter",30,"g"],["parmesan","Parmesan",40,"g"],["stock","Vegetable stock",750,"ml"]]');

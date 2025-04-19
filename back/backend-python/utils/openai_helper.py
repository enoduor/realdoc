import openai
import os

openai.api_key = os.getenv("OPENAI_API_KEY")

def generate_caption(prompt):
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8
    )
    return response['choices'][0]['message']['content']

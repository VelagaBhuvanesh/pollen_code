#include <SDL3/SDL.h>
#include <emscripten.h>
#include <cstdint>

SDL_Window* win = nullptr;
SDL_Renderer* r = nullptr;
SDL_Texture* playerTex = nullptr;
int texW = 0, texH = 0;

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void init_engine() {
        if (win) return;
        SDL_Init(SDL_INIT_VIDEO);
        SDL_CreateWindowAndRenderer("Top-down", 800, 600, 0, &win, &r);
    }

    EMSCRIPTEN_KEEPALIVE
    void clear_screen(int cr, int cg, int cb) {
        SDL_SetRenderDrawColor(r, cr, cg, cb, 255);
        SDL_RenderClear(r);
    }

    EMSCRIPTEN_KEEPALIVE
    void draw_rect(float x, float y, float w, float h, int cr, int cg, int cb) {
        SDL_FRect rect = {x, y, w, h};
        SDL_SetRenderDrawColor(r, cr, cg, cb, 255);
        SDL_RenderFillRect(r, &rect);
    }

    EMSCRIPTEN_KEEPALIVE
    void present_frame() {
        SDL_RenderPresent(r);
    }

    EMSCRIPTEN_KEEPALIVE
    int check_collision(float ax, float ay, float aw, float ah, float bx, float by, float bw, float bh) {
        if (ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by) return 1;
        return 0;
    }

    // --- NEW SPRITE FUNCTIONS ---

    EMSCRIPTEN_KEEPALIVE
    void load_texture(uint8_t* pixels, int w, int h) {
        if (playerTex) SDL_DestroyTexture(playerTex);
        // Create texture from raw RGBA pixels passed from JS
        playerTex = SDL_CreateTexture(r, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STATIC, w, h);
        SDL_UpdateTexture(playerTex, nullptr, pixels, w * 4); 
        texW = w;
        texH = h;
    }

    EMSCRIPTEN_KEEPALIVE
    void draw_sprite(float x, float y, float w, float h) {
        if (playerTex) {
            SDL_FRect dst = {x, y, w, h};
            SDL_RenderTexture(r, playerTex, nullptr, &dst);
        } else {
            // Fallback to a green box if no image is loaded yet
            SDL_FRect dst = {x, y, w, h};
            SDL_SetRenderDrawColor(r, 0, 200, 0, 255);
            SDL_RenderFillRect(r, &dst);
        }
    }
}